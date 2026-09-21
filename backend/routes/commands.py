"""
WebEase — Commands Routes
POST /commands/text   → plain text command → LLM → structured command
                        (use this when browser handles mic itself via Web Speech API)
"""

from fastapi import APIRouter
from pydantic import BaseModel

from services.foundry_service import foundry_service
from services.browser_service import browser_service
from utils.helpers import save_command, sanitize_text

router = APIRouter()


class TextCommandRequest(BaseModel):
    text: str
    page_context: str = ""


@router.post("/text")
async def process_text_command(req: TextCommandRequest):
    """
    Send a plain-text voice command directly (already transcribed by browser).
    Returns the tool call + spoken response.
    """
    text = sanitize_text(req.text)
    if not text:
        return {"status": "error", "detail": "Empty command."}

    # Foundry LLM
    cmd = await foundry_service.process_command(text, page_context=req.page_context)

    # Validate browser command
    if cmd["status"] == "success" and cmd["tool"] not in (None, "clarify", "generate_document", "summarize_document"):
        validation = browser_service.validate_and_prepare(cmd["tool"], cmd["args"])
        if not validation["valid"]:
            cmd["status"] = "error"
            cmd["response_text"] = f"Invalid command: {validation['reason']}"
        else:
            cmd["args"] = validation["args"]

    # Save to history
    save_command(
        command=text,
        tool=cmd.get("tool"),
        args=cmd.get("args", {}),
        status=cmd.get("status", "error"),
        response=cmd.get("response_text", ""),
    )

    return {
        "tool": cmd.get("tool"),
        "args": cmd.get("args", {}),
        "response_text": cmd.get("response_text"),
        "status": cmd.get("status"),
    }
