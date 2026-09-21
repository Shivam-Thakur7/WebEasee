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
            "description": "Click on a webpage element identified by a CSS selector or visible text.",
            "parameters": {
                "type": "object",
                "properties": {
                    "selector": {
                        "type": "string",
                        "description": "CSS selector or visible text of the element to click."
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
            "description": "Type text into the currently focused or specified input field.",
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
                        "default": "input:focus, textarea:focus"
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
            "description": "Open a URL in the current tab.",
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
            "description": "Search for a query on a given site (default Google).",
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
            "description": "Read out the main visible text of the current webpage using text-to-speech.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_selected_text",
            "description": "Read out the currently selected/highlighted text using text-to-speech.",
            "parameters": {"type": "object", "properties": {}, "required": []}
        }
    },
    {
        "type": "function",
        "function": {
            "name": "find_element",
            "description": "Find and highlight an element on the page by description.",
            "parameters": {
                "type": "object",
                "properties": {
                    "description": {
                        "type": "string",
                        "description": "Natural language description of the element to find, e.g. 'search bar' or 'subscribe button'."
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
            "description": "Play a specific video or song directly on YouTube.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The name of the video or song to play, e.g. 'despacito' or 'cats funny video'."
                    }
                },
                "required": ["query"]
            }
        }
    }
]

# Quick lookup by name
BROWSER_TOOLS_MAP = {t["function"]["name"]: t for t in BROWSER_TOOLS}
