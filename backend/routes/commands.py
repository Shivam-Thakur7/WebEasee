"""
WebEase — Commands Routes
POST /commands/text      → plain text command → LLM → structured command
POST /commands/summarize → page text → LLM → spoken summary
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


class SummarizeRequest(BaseModel):
    page_text: str


@router.post("/text")
async def process_text_command(req: TextCommandRequest):
    """
    Send a plain-text voice command (already transcribed by browser).
    Returns the tool call + spoken response.
    """
    text = sanitize_text(req.text)
    if not text:
        return {"status": "error", "detail": "Empty command."}

    # Foundry LLM — decide what tool to call
    cmd = await foundry_service.process_command(text, page_context=req.page_context)

    # Validate browser command args (skip document tools and clarify)
    if cmd["status"] == "success" and cmd["tool"] not in (
        None, "clarify", "generate_document", "summarize_document", "summarize_page"
    ):
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


@router.post("/summarize")
async def summarize_page(req: SummarizeRequest):
    """
    Accept raw page text extracted from the browser tab,
    summarize it with the LLM, and return the spoken summary.
    """
    if not req.page_text or not req.page_text.strip():
        return {
            "summary": "The page appears to have no readable content.",
            "status": "error",
        }

    summary = await foundry_service.summarize_page(req.page_text)
    return {
        "summary": summary,
        "status": "success",
    }
