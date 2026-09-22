"""
WebEase Backend — Configuration
Loads all credentials from environment variables (.env file).
Never hard-code API keys.
"""

import os
from dotenv import load_dotenv

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

# Azure AI Speech (STT / TTS)
AZURE_SPEECH_KEY: str    = os.getenv("AZURE_SPEECH_KEY", "")
AZURE_SPEECH_REGION: str = os.getenv("AZURE_SPEECH_REGION", "eastus")

# Azure AI Foundry (LLM / Agent)
AZURE_AI_ENDPOINT: str   = os.getenv("AZURE_AI_ENDPOINT", "")
AZURE_AI_API_KEY: str    = os.getenv("AZURE_AI_API_KEY", "")
AZURE_AI_MODEL: str      = os.getenv("AZURE_AI_MODEL", "gpt-4.1")

# Application Settings
BACKEND_HOST: str = os.getenv("BACKEND_HOST", "127.0.0.1")
BACKEND_PORT: int = int(os.getenv("BACKEND_PORT", "8000"))
CORS_ORIGINS: list = os.getenv(
    "CORS_ORIGINS",
    "chrome-extension://*,http://localhost:*"
).split(",")

# Documents output directory
DOCS_OUTPUT_DIR: str = os.path.join(os.path.dirname(__file__), "generated_docs")
os.makedirs(DOCS_OUTPUT_DIR, exist_ok=True)

# Security allow-list — only these browser actions are permitted
ALLOWED_BROWSER_TOOLS: list[str] = [
    "scroll",
    "click",
    "type_text",
    "open_url",
    "search",
    "go_back",
    "go_forward",
    "read_page",
    "read_selected_text",
    "find_element",
    "play_video",
    "summarize_page",
    "extension_action",
]

def validate_config() -> list[str]:
    """Return list of missing critical config keys."""
    missing = []
    if not AZURE_SPEECH_KEY:   missing.append("AZURE_SPEECH_KEY")
    if not AZURE_SPEECH_REGION: missing.append("AZURE_SPEECH_REGION")
    if not AZURE_AI_ENDPOINT:  missing.append("AZURE_AI_ENDPOINT")
    if not AZURE_AI_API_KEY:   missing.append("AZURE_AI_API_KEY")
    return missing
