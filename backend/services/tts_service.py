"""
WebEase — Azure AI Speech TTS Service
Lazy initialization — does NOT connect to Azure at import time.
"""

import asyncio
import logging
import tempfile
import os

import config

logger = logging.getLogger("webease.tts")


class TTSService:

    def _get_config(self, voice: str = None):
        import azure.cognitiveservices.speech as speechsdk
        if not config.AZURE_SPEECH_KEY:
            raise RuntimeError("AZURE_SPEECH_KEY is not set in .env")
        cfg = speechsdk.SpeechConfig(
            subscription=config.AZURE_SPEECH_KEY,
            region=config.AZURE_SPEECH_REGION,
        )
        cfg.speech_synthesis_voice_name = voice or "en-US-JennyNeural"
        return cfg

    async def synthesize(self, text: str, voice: str = None, speed: float = 1.0) -> dict:
        """Convert text to speech audio bytes."""
        if not config.AZURE_SPEECH_KEY:
            return {"audio_bytes": None, "status": "error",
                    "detail": "AZURE_SPEECH_KEY not set in .env"}

        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, self._synthesize_sync, text, voice, speed)
        return result

    def _synthesize_sync(self, text: str, voice: str = None, speed: float = 1.0) -> dict:
        import azure.cognitiveservices.speech as speechsdk
        import html
        try:
            cfg = self._get_config(voice)
            voice_name = voice or "en-US-JennyNeural"
            escaped_text = html.escape(text)

            ssml = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
              <voice name='{voice_name}'>
                <prosody rate='{speed}'>{escaped_text}</prosody>
              </voice>
            </speak>"""

            synthesizer = speechsdk.SpeechSynthesizer(
                speech_config=cfg, audio_config=None
            )
            result = synthesizer.speak_ssml_async(ssml).get()

            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                return {"audio_bytes": result.audio_data, "status": "success"}
            elif result.reason == speechsdk.ResultReason.Canceled:
                cancellation = result.cancellation_details
                err_detail = f"TTS Canceled: {cancellation.reason} - {cancellation.error_details}"
                logger.error(err_detail)
                return {"audio_bytes": None, "status": "error", "detail": err_detail}
            else:
                return {"audio_bytes": None, "status": "error", "detail": str(result.reason)}

        except Exception as e:
            logger.error(f"TTS error: {e}")
            return {"audio_bytes": None, "status": "error", "detail": str(e)}


# Singleton — no Azure connection made here
tts_service = TTSService()
