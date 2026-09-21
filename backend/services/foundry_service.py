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

When the user speaks a command:
- Choose the most appropriate browser tool or document tool to call.
- Be precise with tool arguments.
- Never perform actions outside the allowed tool list.
- For ambiguous commands, ask for clarification rather than guessing.
- Always respond in a friendly, concise manner.

Allowed browser actions: scroll, click, type_text, open_url, search, go_back, go_forward,
read_page, read_selected_text, find_element, play_video.
Allowed document actions: generate_document, summarize_document.
"""


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

    def _build_response_text(self, tool: str, args: dict) -> str:
        """Generate a short spoken confirmation for each tool."""
        responses = {
            "scroll":            lambda a: f"Scrolling {a.get('direction', 'down')}.",
            "click":             lambda a: f"Clicking {a.get('selector', 'the element')}.",
            "type_text":         lambda a: f"Typing: {a.get('text', '')}.",
            "open_url":          lambda a: f"Opening {a.get('url', 'the page')}.",
            "search":            lambda a: f"Searching {a.get('site','Google')} for {a.get('query','')}.",
            "go_back":           lambda a: "Going back.",
            "go_forward":        lambda a: "Going forward.",
            "read_page":         lambda a: "Reading the page.",
            "read_selected_text":lambda a: "Reading selected text.",
            "find_element":      lambda a: f"Finding {a.get('description', 'the element')}.",
            "generate_document": lambda a: f"Generating document: {a.get('title', '')}.",
            "summarize_document":lambda a: "Summarizing the document.",
        }
        fn = responses.get(tool)
        return fn(args) if fn else f"Executing {tool}."


# Singleton instance
foundry_service = FoundryService()
