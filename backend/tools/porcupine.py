"""Porcupine wake-word detector.

~1% CPU continuous classifier - replaces the Whisper-based wake loop.

Setup:
  pip install pvporcupine
  Get a free AccessKey from console.picovoice.ai
  Set in backend/.env:
        PORCUPINE_ACCESS_KEY=<your key>
        PORCUPINE_KEYWORD=jarvis        # built-in keyword (free, instant)
    OR  PORCUPINE_KEYWORD_PATH=wake/hey-orion.ppn   # custom-trained file

Built-in keywords include: alexa, americano, blueberry, bumblebee, computer,
grapefruit, grasshopper, hey google, hey siri, jarvis, ok google, picovoice,
porcupine, terminator.
"""
import os
from pathlib import Path
from typing import Optional

_porcupine = None


def is_configured() -> bool:
    return bool(os.getenv("PORCUPINE_ACCESS_KEY", "").strip())


def get_frame_length() -> int:
    """Audio chunk size Porcupine expects. None if not loaded."""
    return _porcupine.frame_length if _porcupine else 512


def get_sample_rate() -> int:
    return _porcupine.sample_rate if _porcupine else 16000


def load() -> bool:
    """Initialize Porcupine. Returns True on success, False otherwise."""
    global _porcupine
    if _porcupine is not None:
        return True

    access_key = os.getenv("PORCUPINE_ACCESS_KEY", "").strip()
    if not access_key:
        print("[Porcupine] No PORCUPINE_ACCESS_KEY set - wake-word disabled")
        return False

    try:
        import pvporcupine
    except ImportError:
        print("[Porcupine] pvporcupine not installed. Run: pip install pvporcupine")
        return False

    keyword_path = os.getenv("PORCUPINE_KEYWORD_PATH", "").strip()
    keyword_name = os.getenv("PORCUPINE_KEYWORD", "jarvis").strip()
    sensitivity = float(os.getenv("PORCUPINE_SENSITIVITY", "0.55"))

    try:
        if keyword_path:
            full_path = Path(keyword_path)
            if not full_path.is_absolute():
                full_path = Path(__file__).parent.parent / keyword_path
            if not full_path.exists():
                print(f"[Porcupine] Custom keyword file not found: {full_path}")
                return False
            _porcupine = pvporcupine.create(
                access_key=access_key,
                keyword_paths=[str(full_path)],
                sensitivities=[sensitivity],
            )
            print(f"[Porcupine] Custom keyword loaded: {full_path.name}")
        else:
            _porcupine = pvporcupine.create(
                access_key=access_key,
                keywords=[keyword_name],
                sensitivities=[sensitivity],
            )
            print(f"[Porcupine] Built-in keyword loaded: '{keyword_name}'")
        return True
    except Exception as e:
        print(f"[Porcupine] init failed: {e}")
        _porcupine = None
        return False


def process(pcm: list[int]) -> bool:
    """Feed a frame of PCM ints. Returns True if wake-word detected."""
    if _porcupine is None:
        return False
    try:
        return _porcupine.process(pcm) >= 0
    except Exception as e:
        print(f"[Porcupine] process error: {e}")
        return False


def cleanup():
    global _porcupine
    if _porcupine is not None:
        try:
            _porcupine.delete()
        except Exception:
            pass
        _porcupine = None
