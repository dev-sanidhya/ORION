import asyncio
import io
import os
from faster_whisper import WhisperModel

_model: WhisperModel | None = None


def load_model():
    global _model
    device = os.getenv("WHISPER_DEVICE", "cuda")
    model_size = os.getenv("WHISPER_MODEL", "base")
    compute = "float16" if device == "cuda" else "int8"
    print(f"[STT] Loading faster-whisper '{model_size}' on {device}...")
    try:
        _model = WhisperModel(model_size, device=device, compute_type=compute)
    except Exception:
        print("[STT] CUDA failed, falling back to CPU")
        _model = WhisperModel(model_size, device="cpu", compute_type="int8")
    print("[STT] Model ready")


def _transcribe_sync(wav_bytes: bytes) -> str:
    if _model is None:
        raise RuntimeError("STT model not loaded")
    buf = io.BytesIO(wav_bytes)
    segments, _ = _model.transcribe(buf, language="en", vad_filter=True)
    text = " ".join(seg.text for seg in segments).strip()
    return text


async def transcribe(wav_bytes: bytes) -> str:
    loop = asyncio.get_event_loop()
    text = await loop.run_in_executor(None, _transcribe_sync, wav_bytes)
    print(f"[STT] Transcribed: '{text}'")
    return text
