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
        try:
            cfg = self._get_config(voice)
            voice_name = voice or "en-US-JennyNeural"

            ssml = f"""<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='en-US'>
              <voice name='{voice_name}'>
                <prosody rate='{speed}'>{text}</prosody>
              </voice>
            </speak>"""

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp_path = tmp.name

            audio_cfg = speechsdk.audio.AudioOutputConfig(filename=tmp_path)
            synthesizer = speechsdk.SpeechSynthesizer(
                speech_config=cfg, audio_config=audio_cfg
            )
            result = synthesizer.speak_ssml_async(ssml).get()

            if result.reason == speechsdk.ResultReason.SynthesizingAudioCompleted:
                with open(tmp_path, "rb") as f:
                    audio_bytes = f.read()
                os.unlink(tmp_path)
                return {"audio_bytes": audio_bytes, "status": "success"}
            else:
                return {"audio_bytes": None, "status": "error", "detail": str(result.reason)}

        except Exception as e:
            logger.error(f"TTS error: {e}")
            return {"audio_bytes": None, "status": "error", "detail": str(e)}


# Singleton — no Azure connection made here
tts_service = TTSService()
