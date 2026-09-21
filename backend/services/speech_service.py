"""
WebEase — Azure AI Speech Service
Handles Speech-to-Text (STT) from raw audio bytes.
Lazy initialization — does NOT connect to Azure at import time.
"""

import asyncio
import logging
import tempfile
import os

import config

logger = logging.getLogger("webease.speech")


class SpeechService:

    def _get_recognizer_config(self):
        """Build SpeechConfig lazily — only when a key is available."""
        import azure.cognitiveservices.speech as speechsdk
        if not config.AZURE_SPEECH_KEY:
            raise RuntimeError("AZURE_SPEECH_KEY is not set in .env")
        cfg = speechsdk.SpeechConfig(
            subscription=config.AZURE_SPEECH_KEY,
            region=config.AZURE_SPEECH_REGION,
        )
        cfg.speech_recognition_language = "en-US"
        return cfg

    async def transcribe_audio(self, audio_bytes: bytes, content_type: str = "audio/wav") -> dict:
        """
        Transcribe raw audio bytes to text using Azure Speech SDK.
        Returns: { "text": str, "confidence": float, "status": str }
        """
        if not config.AZURE_SPEECH_KEY:
            return {"text": "", "confidence": 0.0, "status": "error",
                    "detail": "AZURE_SPEECH_KEY not set in .env"}

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._transcribe_sync, audio_bytes)
        return result

    def _transcribe_sync(self, audio_bytes: bytes) -> dict:
        """Blocking STT call — run in executor to keep FastAPI async."""
        import azure.cognitiveservices.speech as speechsdk
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_bytes)
                tmp_path = tmp.name

            cfg = self._get_recognizer_config()
            audio_cfg = speechsdk.audio.AudioConfig(filename=tmp_path)
            recognizer = speechsdk.SpeechRecognizer(
                speech_config=cfg, audio_config=audio_cfg
            )
            result = recognizer.recognize_once()
            
            # Explicitly delete references so Azure SDK releases the file handle
            del recognizer
            del audio_cfg
            
            try:
                os.unlink(tmp_path)
            except Exception as e:
                logger.warning(f"Could not delete temp file {tmp_path}: {e}")

            if result.reason == speechsdk.ResultReason.RecognizedSpeech:
                return {"text": result.text, "confidence": 1.0, "status": "success"}
            elif result.reason == speechsdk.ResultReason.NoMatch:
                return {"text": "", "confidence": 0.0, "status": "no_match"}
            else:
                if result.reason == speechsdk.ResultReason.Canceled:
                    cancellation_details = result.cancellation_details
                    error_msg = f"Canceled: {cancellation_details.reason} - {cancellation_details.error_details}"
                    logger.error(f"STT Canceled: {error_msg}")
                    return {"text": "", "confidence": 0.0, "status": "error", "detail": error_msg}
                return {"text": "", "confidence": 0.0, "status": "error",
                        "detail": str(result.reason)}

        except Exception as e:
            logger.error(f"STT error: {e}")
            return {"text": "", "confidence": 0.0, "status": "error", "detail": str(e)}


# Singleton — no Azure connection made here
speech_service = SpeechService()
