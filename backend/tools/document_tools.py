"""
WebEase — Document Tool Definitions
Foundry function-calling schemas for document operations.
"""

DOCUMENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "generate_document",
            "description": "Generate a .docx document based on the user's voice prompt.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": "Title of the document."
                    },
                    "content": {
                        "type": "string",
                        "description": "Full text content of the document."
                    },
                    "filename": {
                        "type": "string",
                        "description": "Suggested filename without extension, e.g. 'AI_Overview'."
                    }
                },
                "required": ["title", "content", "filename"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_document",
            "description": "Summarize the text extracted from a document.",
            "parameters": {
                "type": "object",
                "properties": {
                    "text": {
                        "type": "string",
                        "description": "The raw document text to summarize."
                    },
                    "length": {
                        "type": "string",
                        "enum": ["short", "medium", "long"],
                        "default": "medium",
                        "description": "Desired summary length."
                    }
                },
                "required": ["text"]
            }
        }
    },
]

DOCUMENT_TOOLS_MAP = {t["function"]["name"]: t for t in DOCUMENT_TOOLS}
