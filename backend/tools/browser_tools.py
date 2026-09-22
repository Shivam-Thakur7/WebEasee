"""
WebEase — Browser Tool Definitions
These are the Foundry function-calling tool schemas.
The LLM can ONLY call tools defined here (allow-list enforced).
"""

BROWSER_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "scroll",
            "description": "Scroll the current webpage up or down by a given number of pixels.",
            "parameters": {
                "type": "object",
                "properties": {
                    "direction": {
                        "type": "string",
                        "enum": ["up", "down"],
                        "description": "Direction to scroll."
                    },
                    "amount": {
                        "type": "integer",
                        "description": "Number of pixels to scroll. Default 500.",
                        "default": 500
                    }
                },
                "required": ["direction"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "click",
            "description": (
                "Click on a webpage element identified by a CSS selector, visible text label, "
                "or a positional descriptor like 'first video', 'second result', 'third link'. "
                "Use this for positional video/link clicks on the current page."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {
                        "type": "string",
                        "description": (
                            "CSS selector, visible text of the element, or positional phrase "
                            "e.g. 'first video', 'second result', 'Subscribe button'."
                        )
                    }
                },
                "required": ["selector"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "type_text",
            "description": (
                "Type text into an input field or text area on the current page. "
                "Use selector to target a specific field. Set submit=true to press Enter after typing."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The text to type."
                    },
                    "selector": {
                        "type": "string",
                        "description": "Optional CSS selector of the input field.",
                        "default": ""
                    },
                    "submit": {
                        "type": "boolean",
                        "description": "If true, press Enter after typing to submit the form. Default false.",
                        "default": False
                    }
                },
                "required": ["text"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_url",
            "description": (
                "Navigate the current tab to a URL or website homepage. "
                "Use ONLY when the user wants to visit a homepage/URL with no search query "
                "(e.g. 'open youtube', 'go to github.com'). "
                "Do NOT use this for search queries — use 'search' instead."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "url": {
                        "type": "string",
                        "description": "Full URL to open, e.g. https://youtube.com"
                    }
                },
                "required": ["url"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search",
            "description": (
                "Search for a query on a given site (default Google). "
                "Use this when the user says 'search for X', 'find X on YouTube', "
                "'search YouTube for X', 'look up X', etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query."
                    },
                    "site": {
                        "type": "string",
                        "enum": ["google", "youtube", "wikipedia", "bing"],
                        "default": "google",
                        "description": "Which search engine to use."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "go_back",
            "description": "Navigate to the previous page in browser history.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "go_forward",
            "description": "Navigate to the next page in browser history.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_page",
            "description": (
                "Read out the main visible text of the current webpage aloud using text-to-speech. "
                "Use when the user says 'read this page', 'read the page to me', 'read aloud', etc."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_selected_text",
            "description": "Read out the currently selected/highlighted text on the page using text-to-speech.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_element",
            "description": "Find and visually highlight an element on the page by natural language description.",
            "parameters": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "Natural language description of the element, e.g. 'search bar', 'subscribe button'."
                    }
                },
                "required": ["description"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "play_video",
            "description": (
                "Search YouTube for a specific video or song and navigate to the results. "
                "Use when user says 'play X on YouTube', 'play the song X', etc. "
                "For clicking a positional video already on screen, use the 'click' tool instead."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The name of the video or song to play, e.g. 'despacito'."
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_page",
            "description": (
                "Summarize the content of the current webpage and read the summary aloud. "
                "Use when user says 'summarize this page', 'give me a summary', "
                "'what is this page about', 'summarise the article', 'tldr this page', etc."
            ),
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "extension_action",
            "description": (
                "Control the WebEase extension's UI and accessibility settings natively. "
                "Use this when the user says 'toggle dark mode', 'open settings', "
                "'go to documents', 'turn on high contrast', etc."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["toggle_theme", "toggle_large_text", "toggle_high_contrast", "navigate"],
                        "description": "The action to perform."
                    },
                    "tab": {
                        "type": "string",
                        "enum": ["dashboard", "documents", "history", "settings", "profile"],
                        "description": "Which tab to navigate to (only used if action is 'navigate')."
                    }
                },
                "required": ["action"]
            }
        }
    }
]

# Quick lookup by name
BROWSER_TOOLS_MAP = {t["function"]["name"]: t for t in BROWSER_TOOLS}
