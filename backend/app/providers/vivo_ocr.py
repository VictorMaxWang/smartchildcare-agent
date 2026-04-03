from app.core.config import Settings


class VivoOcrProvider:
    def __init__(self, settings: Settings):
        self.settings = settings

    def extract(self, fallback_text: str | None = None) -> dict:
        return {
            "provider": "vivo-ocr-stub",
            "mode": "mock",
            "text": fallback_text or "OCR v1 未接入真实图片上传，当前返回占位文本。",
        }
