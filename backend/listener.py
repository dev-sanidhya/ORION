import pyaudio
import numpy as np
import asyncio
import time
import threading
import wave
import io
from typing import Callable, Awaitable

# Audio constants
RATE = 16000
CHUNK = 1024
CHANNELS = 1

# Clap detection
CLAP_THRESHOLD = 3500
CLAP_WINDOW = 0.8       # max seconds between two claps
CLAP_MIN_GAP = 0.08     # min gap to avoid double-fire on one clap

# Speech recording
SILENCE_THRESHOLD = 400
SILENCE_DURATION = 1.8   # seconds of silence to stop recording
MAX_RECORD_SECONDS = 15

# Wake phrase detection
WAKE_CLIP_SECONDS = 2.0   # length of each clip fed to wake detector
WAKE_COOLDOWN = 3.0       # seconds to ignore after triggering

# Keyboard long-press
SPACE_LONG_PRESS_SECONDS = 0.7


def _pack_wav(frames: list[bytes]) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(CHANNELS)
        wf.setsampwidth(2)
        wf.setframerate(RATE)
        wf.writeframes(b"".join(frames))
    return buf.getvalue()


class AudioListener:
    def __init__(self, on_wake: Callable[[], Awaitable[None]]):
        self.on_wake = on_wake
        self._running = False
        self._loop: asyncio.AbstractEventLoop | None = None
        self._last_trigger = 0.0

    def start(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop
        self._running = True

        # Thread 1: clap detection
        threading.Thread(target=self._clap_thread, daemon=True, name="clap-listener").start()

        # Thread 2: wake phrase detection ("wake up" / "hey orion")
        threading.Thread(target=self._wake_phrase_thread, daemon=True, name="wake-phrase").start()

        # Thread 3: keyboard long-press Space
        threading.Thread(target=self._keyboard_thread, daemon=True, name="keyboard").start()

        print("[ORION] Listeners active: double-clap | say 'wake up' | hold Space")

    def stop(self):
        self._running = False

    def _fire(self):
        """Thread-safe trigger - respects cooldown to avoid double-fires."""
        now = time.time()
        if now - self._last_trigger < WAKE_COOLDOWN:
            return
        self._last_trigger = now
        asyncio.run_coroutine_threadsafe(self.on_wake(), self._loop)

    # ---- Clap detection --------------------------------------------------

    def _clap_thread(self):
        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=pyaudio.paInt16, channels=CHANNELS,
            rate=RATE, input=True, frames_per_buffer=CHUNK,
        )
        last_clap = 0.0
        print("[Clap] Listening for double-clap")

        while self._running:
            try:
                data = stream.read(CHUNK, exception_on_overflow=False)
                amp = int(np.abs(np.frombuffer(data, dtype=np.int16)).max())
                if amp > CLAP_THRESHOLD:
                    now = time.time()
                    gap = now - last_clap
                    if CLAP_MIN_GAP < gap < CLAP_WINDOW:
                        print("[Clap] Double-clap detected!")
                        last_clap = 0.0
                        self._fire()
                        time.sleep(1.0)
                    else:
                        last_clap = now
            except Exception:
                time.sleep(0.05)

        stream.stop_stream()
        stream.close()
        pa.terminate()

    # ---- Wake phrase detection -------------------------------------------

    def _wake_phrase_thread(self):
        from stt import check_wake_phrase_sync

        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=pyaudio.paInt16, channels=CHANNELS,
            rate=RATE, input=True, frames_per_buffer=CHUNK,
        )
        frames_needed = int(RATE / CHUNK * WAKE_CLIP_SECONDS)
        buf: list[bytes] = []
        print("[Wake] Listening for 'wake up' / 'hey orion'")

        while self._running:
            try:
                data = stream.read(CHUNK, exception_on_overflow=False)
                buf.append(data)
                if len(buf) >= frames_needed:
                    clip = _pack_wav(buf)
                    buf = buf[frames_needed // 2:]  # 50% overlap
                    if check_wake_phrase_sync(clip):
                        print("[Wake] Phrase detected!")
                        self._fire()
                        buf = []
                        time.sleep(WAKE_COOLDOWN)
            except Exception:
                time.sleep(0.1)

        stream.stop_stream()
        stream.close()
        pa.terminate()

    # ---- Keyboard long-press Space ---------------------------------------

    def _keyboard_thread(self):
        try:
            from pynput import keyboard

            space_down_at: float | None = None
            fired = False

            def on_press(key):
                nonlocal space_down_at, fired
                if key == keyboard.Key.space and space_down_at is None:
                    space_down_at = time.time()
                    fired = False

            def on_release(key):
                nonlocal space_down_at, fired
                if key == keyboard.Key.space:
                    if space_down_at is not None:
                        held = time.time() - space_down_at
                        if held >= SPACE_LONG_PRESS_SECONDS and not fired:
                            fired = True
                            print(f"[Keyboard] Space held {held:.2f}s - triggering")
                            self._fire()
                    space_down_at = None

            with keyboard.Listener(on_press=on_press, on_release=on_release) as listener:
                print("[Keyboard] Long-press Space to activate")
                while self._running:
                    time.sleep(0.1)
                listener.stop()

        except Exception as e:
            print(f"[Keyboard] Listener failed: {e}")

    # ---- Speech recording -----------------------------------------------

    def record_speech(self) -> bytes:
        """Blocking: record until silence detected. Run from an executor thread."""
        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=pyaudio.paInt16, channels=CHANNELS,
            rate=RATE, input=True, frames_per_buffer=CHUNK,
        )
        frames: list[bytes] = []
        silence_start: float | None = None
        max_chunks = int(RATE / CHUNK * MAX_RECORD_SECONDS)

        while len(frames) < max_chunks:
            data = stream.read(CHUNK, exception_on_overflow=False)
            frames.append(data)
            amp = int(np.abs(np.frombuffer(data, dtype=np.int16)).max())

            if amp < SILENCE_THRESHOLD:
                if silence_start is None:
                    silence_start = time.time()
                elif time.time() - silence_start >= SILENCE_DURATION:
                    break
            else:
                silence_start = None

        stream.stop_stream()
        stream.close()
        pa.terminate()
        return _pack_wav(frames)
