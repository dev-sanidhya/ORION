import asyncio
import os
import queue
import threading
import time

# pyttsx3 - fully offline, no network, no 403s
import pyttsx3

RATE = int(os.getenv("ORION_TTS_RATE", "185"))
VOLUME = float(os.getenv("ORION_TTS_VOLUME", "0.95"))

_tts_queue: queue.Queue = queue.Queue()
_tts_thread: threading.Thread | None = None


def _find_best_voice(engine: pyttsx3.Engine) -> str | None:
    """Pick best available voice - prefer British male, fall back to any male."""
    voices = engine.getProperty("voices")
    preference = ["george", "hazel", "ryan", "david", "mark", "zira"]
    voice_map = {v.name.lower(): v.id for v in voices}

    for pref in preference:
        for name, vid in voice_map.items():
            if pref in name:
                return vid
    return voices[0].id if voices else None


def _tts_worker():
    """Runs in a dedicated thread - pyttsx3 must stay on one thread."""
    engine = pyttsx3.init()
    engine.setProperty("rate", RATE)
    engine.setProperty("volume", VOLUME)

    best_voice = _find_best_voice(engine)
    if best_voice:
        engine.setProperty("voice", best_voice)

    print(f"[TTS] pyttsx3 ready | voice: {best_voice} | rate: {RATE}")

    while True:
        item = _tts_queue.get()
        if item is None:
            break
        text, done_event, loop = item
        try:
            engine.say(text)
            engine.runAndWait()
        except Exception as e:
            print(f"[TTS] Error: {e}")
        finally:
            if done_event and loop:
                loop.call_soon_threadsafe(done_event.set)


def start_tts_engine():
    global _tts_thread
    _tts_thread = threading.Thread(target=_tts_worker, daemon=True, name="tts-worker")
    _tts_thread.start()


async def speak(text: str):
    if not text.strip():
        return
    loop = asyncio.get_event_loop()
    done = asyncio.Event()
    _tts_queue.put((text, done, loop))
    await done.wait()


def enqueue(text: str, loop: asyncio.AbstractEventLoop) -> asyncio.Event:
    """Queue a sentence, return its done event (non-blocking)."""
    done = asyncio.Event()
    if text.strip():
        _tts_queue.put((text, done, loop))
    else:
        loop.call_soon_threadsafe(done.set)
    return done


def speak_sync(text: str):
    if text.strip():
        _tts_queue.put((text, None, None))


def stop_tts_engine():
    _tts_queue.put(None)
