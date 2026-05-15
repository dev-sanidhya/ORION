"""openWakeWord - open-source wake-word detector.

No account, no API key, no expiry. MIT license.
First run downloads pre-trained ONNX models (~10MB) to the openwakeword
cache directory.

Configure via env:
  ORION_WAKE_WORD=hey_jarvis       # built-in model, default
  ORION_WAKE_WORD_PATH=...         # OR absolute path to a custom .onnx model
  ORION_WAKE_THRESHOLD=0.5         # detection sensitivity (higher = stricter)

Built-in models: hey_jarvis, alexa, hey_mycroft, hey_rhasspy, weather,
timer. Full list in the openwakeword GitHub releases.
"""
import os
import numpy as np
from typing import Optional

_model = None
_threshold: float = 0.5
_target_key: Optional[str] = None
# openWakeWord wants 80ms chunks at 16kHz = 1280 samples per call.
FRAME_SAMPLES = 1280


def load() -> bool:
    """Initialize openWakeWord. Returns True on success."""
    global _model, _threshold, _target_key

    enabled = os.getenv("ORION_WAKE_WORD", "").strip() or os.getenv("ORION_WAKE_WORD_PATH", "").strip()
    if not enabled:
        return False

    try:
        from openwakeword.model import Model
        from openwakeword import utils as oww_utils
    except ImportError:
        print("[WakeWord] openwakeword not installed. Run: pip install openwakeword onnxruntime")
        return False

    _threshold = float(os.getenv("ORION_WAKE_THRESHOLD", "0.5"))
    custom_path = os.getenv("ORION_WAKE_WORD_PATH", "").strip()
    name = os.getenv("ORION_WAKE_WORD", "hey_jarvis").strip()

    try:
        if custom_path:
            _model = Model(wakeword_models=[custom_path], inference_framework="onnx")
            _target_key = None  # match against any score in the dict
            print(f"[WakeWord] Custom model loaded: {custom_path}")
        else:
            # Pre-trained models are downloaded on first use into the
            # openwakeword cache. Trigger that explicitly so we fail fast
            # here rather than at first audio frame.
            try:
                oww_utils.download_models([name])
            except Exception:
                pass  # download_models is best-effort; Model() will retry
            _model = Model(wakeword_models=[name], inference_framework="onnx")
            _target_key = name
            print(f"[WakeWord] Loaded built-in model: '{name}' (threshold={_threshold})")
        return True
    except Exception as e:
        print(f"[WakeWord] init failed: {e}")
        _model = None
        return False


def detect(pcm_bytes: bytes) -> bool:
    """Feed a chunk of int16 PCM. Returns True if wake word fired this chunk.

    openWakeWord is stateful internally - it carries a rolling window across
    calls, so we don't need to manage that buffer ourselves. Just pass the
    raw 16-bit mono samples at 16 kHz.
    """
    if _model is None:
        return False

    try:
        samples = np.frombuffer(pcm_bytes, dtype=np.int16)
        if samples.size == 0:
            return False
        scores = _model.predict(samples)
        if not scores:
            return False
        # If we pinned a target key, only watch that one. Otherwise treat
        # any model in the bundle as a positive trigger.
        if _target_key is not None:
            # The dict key includes a model-version suffix, e.g. "hey_jarvis_v0.1"
            for key, score in scores.items():
                if key.startswith(_target_key) and score >= _threshold:
                    return True
            return False
        else:
            return any(s >= _threshold for s in scores.values())
    except Exception as e:
        print(f"[WakeWord] predict error: {e}")
        return False


def reset():
    """Clear internal state after a detection so we don't double-fire."""
    if _model is not None:
        try:
            _model.reset()
        except Exception:
            pass
