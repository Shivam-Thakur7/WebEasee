"""
WebEase — Voice Routes
POST /voice/transcribe   → audio bytes → transcribed text
POST /voice/process      → audio bytes → full command pipeline (STT + LLM + validation)
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse

from services.speech_service import speech_service
from services.tts_service import tts_service
from services.foundry_service import foundry_service
from services.browser_service import browser_service
from utils.helpers import save_command, sanitize_text

router = APIRouter()


@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """
    Receive a WAV audio file and return transcribed text.
    Used when you want STT only (frontend handles the rest).
    """
    audio_bytes = await audio.read()
    result = await speech_service.transcribe_audio(audio_bytes)

    if result["status"] != "success":
        raise HTTPException(status_code=422, detail=result.get("detail", "Transcription failed"))

    return {"text": result["text"], "confidence": result["confidence"]}


@router.post("/process")
async def process_voice(
    audio: UploadFile = File(...),
    page_context: str = Form(default=""),
):
    """
    Full pipeline:
      audio → STT → Foundry LLM → browser/doc command → validated payload
    Returns the command the extension should execute + a spoken response.
    """
    audio_bytes = await audio.read()

    # Step 1: Speech → Text
    stt = await speech_service.transcribe_audio(audio_bytes)
    if stt["status"] != "success" or not stt["text"]:
        return JSONResponse(
            status_code=422,
            content={"status": "error", "detail": stt.get("detail", "Could not understand audio.")}
        )

    text = sanitize_text(stt["text"])

    # Step 2: Text → Foundry LLM
    cmd = await foundry_service.process_command(text, page_context=page_context)

    # Step 3: Validate browser command if applicable
    if cmd["status"] == "success" and cmd["tool"] not in (None, "clarify", "generate_document", "summarize_document"):
        validation = browser_service.validate_and_prepare(cmd["tool"], cmd["args"])
        if not validation["valid"]:
            cmd["status"] = "error"
            cmd["response_text"] = f"Invalid command: {validation['reason']}"
        else:
            cmd["args"] = validation["args"]

    # Step 4: Persist to history
    save_command(
        command=text,
        tool=cmd.get("tool"),
        args=cmd.get("args", {}),
        status=cmd.get("status", "error"),
        response=cmd.get("response_text", ""),
    )

    return {
        "transcribed_text": text,
        "tool": cmd.get("tool"),
        "args": cmd.get("args", {}),
        "response_text": cmd.get("response_text"),
        "status": cmd.get("status"),
    }


@router.post("/speak")
async def speak(text: str = Form(...)):
    """
    Text to Speech endpoint.
    Returns the audio bytes for the given text.
    """
    from fastapi.responses import Response
    
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
        
    result = await tts_service.synthesize(text)
    
    if result["status"] != "success":
        raise HTTPException(status_code=500, detail=result.get("detail", "TTS failed"))
        
    return Response(content=result["audio_bytes"], media_type="audio/wav")
