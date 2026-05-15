import asyncio
import io
import os
import threading

# faster_whisper is imported lazily inside _load_models_sequential so the
# heavy CTranslate2 / CUDA stack is never imported when running in cloud-only
# (Groq) mode. Saves ~300MB RSS and several seconds of startup time.
_wake_model = None
_main_model = None

# Groq client - primary STT if API key is set
_groq_client = None

WAKE_PHRASES = ["wake up", "hey orion", "orion wake", "wake orion"]

# Feature flags - default to lightweight mode.
# ORION_WAKE_PHRASE=1   -> load tiny whisper + run continuous wake detection
# ORION_LOCAL_STT=1     -> load main whisper as fallback when no Groq key
_WAKE_ENABLED = os.getenv("ORION_WAKE_PHRASE", "0") == "1"
_LOCAL_STT_FORCED = os.getenv("ORION_LOCAL_STT", "0") == "1"


def wake_phrase_enabled() -> bool:
    return _WAKE_ENABLED


def load_model():
    """Non-blocking. Skips local whisper entirely when Groq is configured
    and the user hasn't opted in to wake-phrase / local fallback."""
    global _groq_client

    groq_key = os.getenv("GROQ_API_KEY", "").strip()
    if groq_key:
        try:
            from groq import Groq
            _groq_client = Groq(api_key=groq_key)
            print("[STT] Groq ready (whisper-large-v3-turbo)")
        except Exception as e:
            print(f"[STT] Groq init failed: {e}")

    need_wake = _WAKE_ENABLED
    need_main = _LOCAL_STT_FORCED or _groq_client is None

    if not need_wake and not need_main:
        print("[STT] Cloud-only mode (no local whisper). "
              "Set ORION_LOCAL_STT=1 for fallback or ORION_WAKE_PHRASE=1 for wake-word.")
        return

    threading.Thread(
        target=_load_models_sequential,
        args=(need_wake, need_main),
        daemon=True,
        name="stt-loader",
    ).start()


def _load_models_sequential(need_wake: bool, need_main: bool):
    """Loads only the models actually requested. Sequential to avoid CUDA double-init segfault."""
    global _wake_model, _main_model
    from faster_whisper import WhisperModel

    device = os.getenv("WHISPER_DEVICE", "cuda")
    compute = "float16" if device == "cuda" else "int8"

    if need_wake:
        print("[STT] Loading wake model (tiny)...")
        try:
            _wake_model = WhisperModel("tiny", device=device, compute_type=compute)
        except Exception:
            _wake_model = WhisperModel("tiny", device="cpu", compute_type="int8")
        print("[STT] Wake model ready")

    if need_main:
        size = os.getenv("WHISPER_MODEL", "small")
        print(f"[STT] Loading main model ({size})...")
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


def _transcribe_local_sync(wav_bytes: bytes, model) -> str:
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
