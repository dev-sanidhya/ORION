import asyncio
import io
import os
import threading
from faster_whisper import WhisperModel

# Two models:
# - _wake_model: tiny, always loaded, used for wake phrase detection (fast)
# - _main_model: small/medium, used for actual command transcription (accurate)
_wake_model: WhisperModel | None = None
_main_model: WhisperModel | None = None

# Groq client - primary STT if API key is set
_groq_client = None

WAKE_PHRASES = ["wake up", "hey orion", "orion wake", "wake orion"]


def load_model():
    """Non-blocking - kicks off model downloads in background threads."""
    global _groq_client

    # Groq setup first - instant, no download
    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if groq_key:
        try:
            from groq import Groq
            _groq_client = Groq(api_key=groq_key)
            print("[STT] Groq client ready (whisper-large-v3-turbo)")
        except Exception as e:
            print(f"[STT] Groq init failed: {e}")

    # Load both whisper models in background - don't block server startup
    threading.Thread(target=_load_wake_model, daemon=True, name="load-wake-model").start()
    threading.Thread(target=_load_main_model, daemon=True, name="load-main-model").start()


def _load_wake_model():
    global _wake_model
    device = os.getenv("WHISPER_DEVICE", "cuda")
    compute = "float16" if device == "cuda" else "int8"
    print("[STT] Downloading wake model (tiny, ~39MB)...")
    try:
        _wake_model = WhisperModel("tiny", device=device, compute_type=compute)
    except Exception:
        _wake_model = WhisperModel("tiny", device="cpu", compute_type="int8")
    print("[STT] Wake model (tiny) ready")


def _load_main_model():
    global _main_model
    device = os.getenv("WHISPER_DEVICE", "cuda")
    compute = "float16" if device == "cuda" else "int8"
    size = os.getenv("WHISPER_MODEL", "small")
    print(f"[STT] Downloading main model ({size})...")
    try:
        _main_model = WhisperModel(size, device=device, compute_type=compute)
    except Exception:
        _main_model = WhisperModel(size, device="cpu", compute_type="int8")
    print(f"[STT] Main model ({size}) ready")


def _transcribe_groq_sync(wav_bytes: bytes) -> str:
    """Groq cloud STT - whisper-large-v3-turbo, best accuracy."""
    response = _groq_client.audio.transcriptions.create(
        file=("audio.wav", io.BytesIO(wav_bytes)),
        model="whisper-large-v3-turbo",
        language="en",
        response_format="text",
    )
    return str(response).strip()


def _transcribe_local_sync(wav_bytes: bytes, model: WhisperModel) -> str:
    """Local faster-whisper fallback."""
    buf = io.BytesIO(wav_bytes)
    segments, _ = model.transcribe(buf, language="en", vad_filter=True, beam_size=5)
    return " ".join(seg.text for seg in segments).strip()


def check_wake_phrase_sync(wav_bytes: bytes) -> bool:
    """Fast local check for wake phrases - runs every ~1.5s in background thread."""
    if not _wake_model:
        return False
    try:
        buf = io.BytesIO(wav_bytes)
        segments, _ = _wake_model.transcribe(
            buf, language="en", vad_filter=False, beam_size=1, best_of=1
        )
        text = " ".join(seg.text for seg in segments).lower().strip()
        return any(phrase in text for phrase in WAKE_PHRASES)
    except Exception:
        return False


async def transcribe(wav_bytes: bytes) -> str:
    """Full transcription - Groq if available, else local small model."""
    loop = asyncio.get_event_loop()

    if _groq_client:
        try:
            text = await loop.run_in_executor(None, _transcribe_groq_sync, wav_bytes)
            print(f"[STT] Groq: '{text}'")
            return text
        except Exception as e:
            print(f"[STT] Groq failed ({e}), falling back to local")

    if _main_model:
        text = await loop.run_in_executor(None, _transcribe_local_sync, wav_bytes, _main_model)
        print(f"[STT] Local: '{text}'")
        return text

    return ""
