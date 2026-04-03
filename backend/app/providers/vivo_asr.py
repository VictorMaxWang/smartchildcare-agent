from app.core.config import Settings


class VivoAsrProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    def transcribe(self, fallback_text: str | None = None) -> dict:
        return {
            "provider": "vivo-asr-stub",
            "mode": "mock",
            "transcript": fallback_text or "ASR v1 预留 WebSocket 能力，当前返回占位转写。",
        }
