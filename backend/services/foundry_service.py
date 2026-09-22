"""
WebEase — Azure AI Foundry Service
Sends transcribed text to the LLM and gets back a structured tool call.
"""

import json
import logging
from openai import AzureOpenAI, OpenAI

import config
from tools.browser_tools import BROWSER_TOOLS, BROWSER_TOOLS_MAP
from tools.document_tools import DOCUMENT_TOOLS

logger = logging.getLogger("webease.foundry")

SYSTEM_PROMPT = """You are WebEase, an AI accessibility assistant embedded in a Chrome browser extension.
Your job is to help physically disabled users control their browser and create documents using voice commands.

When the user speaks a command, choose the MOST APPROPRIATE tool from the list below.

## Tool Selection Rules

### Navigation
- "open youtube", "go to github.com", "open google" → `open_url` with the homepage URL.
  Do NOT use open_url for search queries.

### Search
- "search for X", "look up X", "find X", "search youtube for X", "search X on google" → `search` with the correct site and query.
- "search youtube for guitar" → `search` with site="youtube", query="guitar".
- NEVER use `open_url` when there is a search query involved.

### Play a specific video/song
- "play Bohemian Rhapsody", "play despacito on youtube" → `play_video` with query="Bohemian Rhapsody".
  This navigates to YouTube search results for that song/video.

### Positional click (already on a page)
- "play the first video", "click the second result", "open the 3rd link", "play video 1" →
  `click` with selector="first video" (or "second result", etc.).
  NEVER ask for a site when the user says "first video" / "second result" — they mean what is visible on screen.

### Reading aloud
- "read this page", "read aloud", "read the page to me" → `read_page`
- "read the selected text", "read what I highlighted" → `read_selected_text`

### Summarise
- "summarise this page", "summarize", "give me a summary", "what is this page about",
  "tldr", "summarise the article", "brief me on this page" → `summarize_page`

### Scroll
- "scroll down", "scroll up 300 pixels" → `scroll` with direction and amount.

### Type text
- "type hello in the search bar", "type my name" → `type_text` with text and optional selector.
  Set submit=true ONLY if user says "and submit" / "and search" / "press enter".

### History
- "go back", "previous page" → `go_back`
- "go forward", "next page" → `go_forward`

### Find element
- "find the subscribe button", "highlight the search box" → `find_element` with description.

### Documents
- "create a document about X", "write a document on Y" → `generate_document`
- "summarise the document" (referring to a WebEase doc, not a webpage) → `summarize_document`

### Extension UI Controls
- "toggle dark mode", "switch to dark theme", "change theme" → `extension_action` with action="toggle_theme"
- "turn on large text", "make text bigger" → `extension_action` with action="toggle_large_text"
- "open settings", "go to documents", "show history", "open profile" → `extension_action` with action="navigate" and tab="settings" (or documents, history, profile, dashboard)

### Greetings / no action
- "hello agent", "hey", "hi" → reply with a brief, friendly confirmation only; do NOT call any tool.

### Ambiguous
- If genuinely unclear, ask for clarification.

Always respond in a clear, friendly, and concise manner.
"""

SUMMARIZE_SYSTEM_PROMPT = """You are a helpful assistant. The user has shared the text content of a webpage.
Write a concise, spoken-word summary (2-4 sentences) of the most important information.
Focus on the key points. Respond naturally as if speaking aloud to the user.
Do NOT include markdown, bullet points, or headers — just plain spoken sentences."""


class FoundryService:
    def __init__(self):
        self._client = None

    def _get_client(self):
        if self._client is None:
            endpoint = (config.AZURE_AI_ENDPOINT or "").strip()
            if "/openai/v1" in endpoint or "/v1" in endpoint or "services.ai.azure.com" in endpoint:
                self._client = OpenAI(
                    base_url=endpoint,
                    api_key=config.AZURE_AI_API_KEY,
                )
            else:
                self._client = AzureOpenAI(
                    azure_endpoint=endpoint,
                    api_key=config.AZURE_AI_API_KEY,
                    api_version="2024-05-01-preview",
                )
        return self._client

    async def process_command(self, text: str, page_context: str = "") -> dict:
        """
        Send transcribed voice text to Azure AI Foundry.
        Returns a structured command dict.

        Returns:
        {
          "tool": "scroll" | "open_url" | ... | "generate_document" | "clarify",
          "args": { ... },
          "response_text": "Opening YouTube now.",
          "status": "success" | "error" | "clarify"
        }
        """
        if not config.AZURE_AI_ENDPOINT:
            return {
                "tool": None,
                "args": {},
                "response_text": "Azure AI Foundry is not configured.",
                "status": "error",
            }

        try:
            client = self._get_client()
            all_tools = BROWSER_TOOLS + DOCUMENT_TOOLS

            messages = [{"role": "system", "content": SYSTEM_PROMPT}]

            if page_context:
                messages.append({
                    "role": "system",
                    "content": f"Current page context:\n{page_context[:2000]}"
                })

            messages.append({"role": "user", "content": text})

            response = client.chat.completions.create(
                model=config.AZURE_AI_MODEL,
                messages=messages,
                tools=all_tools,
                tool_choice="auto",
            )

            choice = response.choices[0]
            message = choice.message

            # Model called a tool
            if message.tool_calls:
                tool_call = message.tool_calls[0]
                tool_name = tool_call.function.name
                tool_args = json.loads(tool_call.function.arguments)

                # Security: enforce allow-list
                allowed = config.ALLOWED_BROWSER_TOOLS + ["generate_document", "summarize_document"]
                if tool_name not in allowed:
                    logger.warning(f"Blocked disallowed tool: {tool_name}")
                    return {
                        "tool": None,
                        "args": {},
                        "response_text": "That action is not permitted.",
                        "status": "error",
                    }

                # Build a friendly spoken response
                spoken = self._build_response_text(tool_name, tool_args)

                return {
                    "tool": tool_name,
                    "args": tool_args,
                    "response_text": spoken,
                    "status": "success",
                }

            # Model replied with text (clarification or info)
            reply = message.content or "I didn't understand that command."
            return {
                "tool": "clarify",
                "args": {},
                "response_text": reply,
                "status": "clarify",
            }

        except Exception as e:
            logger.error(f"Foundry error: {e}")
            return {
                "tool": None,
                "args": {},
                "response_text": "There was an error processing your command.",
                "status": "error",
            }

    async def summarize_page(self, page_text: str) -> str:
        """
        Given raw page text, ask the LLM to produce a concise spoken summary.
        Returns the summary string.
        """
        if not config.AZURE_AI_ENDPOINT:
            return "Azure AI is not configured."
        if not page_text or not page_text.strip():
            return "The page appears to have no readable text."

        try:
            client = self._get_client()
            # Truncate to ~4000 chars to stay within context limits
            truncated = page_text.strip()[:4000]

            messages = [
                {"role": "system", "content": SUMMARIZE_SYSTEM_PROMPT},
                {"role": "user", "content": f"Page content:\n\n{truncated}"},
            ]

            response = client.chat.completions.create(
                model=config.AZURE_AI_MODEL,
                messages=messages,
                max_tokens=300,
            )
            return response.choices[0].message.content or "I couldn't generate a summary."
        except Exception as e:
            logger.error(f"Summarize error: {e}")
            return "Sorry, I couldn't summarize the page right now."

    def _build_response_text(self, tool: str, args: dict) -> str:
        """Generate a short spoken confirmation for each tool."""
        responses = {
            "scroll":             lambda a: f"Scrolling {a.get('direction', 'down')}.",
            "click":              lambda a: f"Clicking {a.get('selector', 'the element')}.",
            "type_text":          lambda a: f"Typing: {a.get('text', '')}.",
            "open_url":           lambda a: f"Opening {a.get('url', 'the page')}.",
            "search":             lambda a: f"Searching {a.get('site', 'Google')} for {a.get('query', '')}.",
            "go_back":            lambda a: "Going back.",
            "go_forward":         lambda a: "Going forward.",
            "read_page":          lambda a: "Reading the page.",
            "read_selected_text": lambda a: "Reading selected text.",
            "find_element":       lambda a: f"Finding {a.get('description', 'the element')}.",
            "play_video":         lambda a: f"Playing {a.get('query', 'the video')} on YouTube.",
            "summarize_page":     lambda a: "Summarizing the page for you.",
            "generate_document":  lambda a: f"Generating document: {a.get('title', '')}.",
            "summarize_document": lambda a: "Summarizing the document.",
            "extension_action":   lambda a: f"Executing {a.get('action', 'extension command').replace('_', ' ')}.",
        }
        fn = responses.get(tool)
        return fn(args) if fn else f"Executing {tool}."


# Singleton instance
foundry_service = FoundryService()
