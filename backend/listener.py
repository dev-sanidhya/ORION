import pyaudio
import numpy as np
import asyncio
import time
import threading
import wave
import io
import os
from typing import Callable, Awaitable

RATE = 16000
CHUNK = 1024
CHANNELS = 1

CLAP_THRESHOLD = 3500
CLAP_WINDOW = 0.8
CLAP_MIN_GAP = 0.08

SILENCE_THRESHOLD = 400
SILENCE_DURATION = 1.8
MAX_RECORD_SECONDS = 15

WAKE_CLIP_CHUNKS = int(RATE / CHUNK * 2.0)   # 2 seconds of chunks
WAKE_COOLDOWN = 3.0

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
        self.clap_threshold = CLAP_THRESHOLD
        self.current_amplitude: int = 0
        self.muted: bool = False  # suppresses clap+wake detection while TTS plays
        self._wake_enabled: bool = os.getenv("ORION_WAKE_PHRASE", "0") == "1"

    def start(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop
        self._running = True

        # Single audio capture thread - avoids multiple PyAudio() init crash
        threading.Thread(target=self._audio_capture_thread, daemon=True, name="audio-capture").start()

        # Keyboard long-press Space
        threading.Thread(target=self._keyboard_thread, daemon=True, name="keyboard").start()

        modes = ["double-clap", "hold Space"]
        if self._wake_enabled:
            modes.insert(1, "say 'wake up'")
        print(f"[ORION] Listeners active: {' | '.join(modes)}")

    def stop(self):
        self._running = False

    def _fire(self):
        now = time.time()
        if now - self._last_trigger < WAKE_COOLDOWN:
            return
        self._last_trigger = now
        asyncio.run_coroutine_threadsafe(self.on_wake(), self._loop)

    # ---- Single audio capture thread - fans out to clap + wake detection ----

    def _audio_capture_thread(self):
        check_wake_phrase_sync = None
        if self._wake_enabled:
            from stt import check_wake_phrase_sync as _wake_check
            check_wake_phrase_sync = _wake_check

        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=pyaudio.paInt16, channels=CHANNELS,
            rate=RATE, input=True, frames_per_buffer=CHUNK,
        )

        last_clap = 0.0
        wake_buf: list[bytes] = []
        # Decimate amplitude updates - the UI animates at <=10fps, no need to
        # update on every 64ms audio chunk. Saves on store re-renders too.
        amp_decim = 0

        print(f"[Audio] Capture thread started (wake_phrase={self._wake_enabled})")

        while self._running:
            try:
                data = stream.read(CHUNK, exception_on_overflow=False)

                amp = int(np.abs(np.frombuffer(data, dtype=np.int16)).max())
                amp_decim = (amp_decim + 1) % 3
                if amp_decim == 0:
                    self.current_amplitude = amp

                if self.muted:
                    continue

                # --- Clap detection ---
                if amp > self.clap_threshold:
                    now = time.time()
                    gap = now - last_clap
                    if CLAP_MIN_GAP < gap < CLAP_WINDOW:
                        print("[Clap] Double-clap!")
                        last_clap = 0.0
                        self._fire()
                        time.sleep(1.0)
                    else:
                        last_clap = now

                # --- Wake phrase detection (opt-in via ORION_WAKE_PHRASE=1) ---
                # When disabled we skip the whisper inference loop entirely;
                # the rolling buffer is the expensive part because each
                # transcribe() call runs faster-whisper end-to-end.
                if check_wake_phrase_sync is not None:
                    wake_buf.append(data)
                    if len(wake_buf) >= WAKE_CLIP_CHUNKS:
                        clip = _pack_wav(wake_buf)
                        wake_buf = wake_buf[WAKE_CLIP_CHUNKS // 2:]
                        if check_wake_phrase_sync(clip):
                            print("[Wake] 'wake up' detected!")
                            self._fire()
                            wake_buf = []
                            time.sleep(WAKE_COOLDOWN)

            except Exception as e:
                print(f"[Audio] Error: {e}")
                time.sleep(0.05)

        stream.stop_stream()
        stream.close()
        pa.terminate()

    # ---- Keyboard long-press Space ----------------------------------------

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
                            print(f"[Keyboard] Space held {held:.2f}s - wake!")
                            self._fire()
                    space_down_at = None

            with keyboard.Listener(on_press=on_press, on_release=on_release):
                print("[Keyboard] Long-press Space active")
                while self._running:
                    time.sleep(0.1)

        except Exception as e:
            print(f"[Keyboard] Failed: {e}")

    # ---- Speech recording (called from executor) -------------------------

    def record_speech(self) -> bytes:
        """Blocking: opens a dedicated stream for recording until silence."""
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
