from app.core.config import Settings


class VivoTtsProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    def synthesize(self, text: str) -> dict:
        return {
            "provider": "vivo-tts-stub",
            "mode": "mock",
            "script": text.strip(),
        }
