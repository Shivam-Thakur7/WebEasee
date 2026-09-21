"""
WebEase — Documents Routes
POST /documents/generate   → prompt text → LLM → .docx file
POST /documents/read       → uploaded .docx → extracted text + optional TTS
GET  /documents/download/{filename}
"""

import os
from fastapi import APIRouter, UploadFile, File
from fastapi.responses import FileResponse
from pydantic import BaseModel

from services.foundry_service import foundry_service
from services.document_service import document_service
from services.tts_service import tts_service
from utils.helpers import sanitize_text
import config

router = APIRouter()


class GenerateDocRequest(BaseModel):
    prompt: str
    read_aloud: bool = False


@router.post("/generate")
async def generate_document(req: GenerateDocRequest):
    """
    Generate a .docx document from a voice/text prompt via Azure AI Foundry.
    """
    prompt = sanitize_text(req.prompt)
    if not prompt:
        return {"status": "error", "detail": "Prompt is empty."}

    # Ask Foundry to generate content
    cmd = await foundry_service.process_command(
        f"Generate a document for: {prompt}",
        page_context=""
    )

    if cmd.get("tool") != "generate_document":
        # Fallback: use prompt directly as content if Foundry didn't call the tool
        title    = "WebEase Document"
        content  = prompt
        filename = "webease_doc"
    else:
        args     = cmd.get("args", {})
        title    = args.get("title", "WebEase Document")
        content  = args.get("content", prompt)
        filename = args.get("filename", "webease_doc")

    result = document_service.generate_docx(title, content, filename)

    if result["status"] != "success":
        return {"status": "error", "detail": result.get("detail")}

    response = {
        "status": "success",
        "filename": result["filename"],
        "title": title,
        "content_preview": content[:300],
        "download_url": f"/documents/download/{result['filename']}",
    }

    # Optionally speak the document
    if req.read_aloud:
        tts_result = await tts_service.synthesize(f"Document generated: {title}. {content[:500]}")
        if tts_result["status"] == "success":
            response["tts_available"] = True

    return response


@router.post("/read")
async def read_document(file: UploadFile = File(...), summarize: bool = False):
    """
    Upload a .docx file → extract text → optionally summarize via Foundry.
    """
    if not file.filename.endswith(".docx"):
        return {"status": "error", "detail": "Only .docx files are supported."}

    # Save temporarily
    tmp_path = os.path.join(config.DOCS_OUTPUT_DIR, f"tmp_{file.filename}")
    content = await file.read()
    with open(tmp_path, "wb") as f:
        f.write(content)

    # Extract text
    extracted = document_service.extract_text(tmp_path)
    os.remove(tmp_path)

    if extracted["status"] != "success":
        return {"status": "error", "detail": extracted.get("detail")}

    text = extracted["text"]
    summary = None

    if summarize and text:
        cmd = await foundry_service.process_command(
            f"Summarize this document in medium length: {text[:3000]}"
        )
        summary = cmd.get("response_text")

    return {
        "status": "success",
        "text": text,
        "summary": summary,
        "word_count": len(text.split()),
    }


@router.get("/download/{filename}")
async def download_document(filename: str):
    """Serve a generated .docx file for download."""
    safe = os.path.basename(filename)
    path = os.path.join(config.DOCS_OUTPUT_DIR, safe)
    if not os.path.exists(path):
        return {"status": "error", "detail": "File not found."}
    return FileResponse(
        path,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename=safe,
    )
