import pyaudio
import numpy as np
import asyncio
import time
import threading
import wave
import io
from typing import Callable, Awaitable

RATE = 16000
CHUNK = 1024
CLAP_THRESHOLD = 3500
CLAP_WINDOW = 0.8        # max seconds between two claps
CLAP_MIN_GAP = 0.08      # min gap to avoid single clap double-firing
SILENCE_THRESHOLD = 400
SILENCE_DURATION = 1.8   # seconds of silence to stop recording
MAX_RECORD_SECONDS = 15


class AudioListener:
    def __init__(self, on_wake: Callable[[], Awaitable[None]]):
        self.on_wake = on_wake
        self._running = False
        self._loop: asyncio.AbstractEventLoop | None = None
        self._pa = pyaudio.PyAudio()

    def start(self, loop: asyncio.AbstractEventLoop):
        self._loop = loop
        self._running = True
        thread = threading.Thread(target=self._listen_thread, daemon=True)
        thread.start()

    def stop(self):
        self._running = False
        self._pa.terminate()

    def _listen_thread(self):
        stream = self._pa.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=RATE,
            input=True,
            frames_per_buffer=CHUNK,
        )
        last_clap = 0.0
        print("[ORION] Clap listener active - double clap to wake")

        while self._running:
            try:
                data = stream.read(CHUNK, exception_on_overflow=False)
                amplitude = int(np.abs(np.frombuffer(data, dtype=np.int16)).max())

                if amplitude > CLAP_THRESHOLD:
                    now = time.time()
                    gap = now - last_clap
                    if CLAP_MIN_GAP < gap < CLAP_WINDOW:
                        print("[ORION] Double clap detected!")
                        last_clap = 0.0
                        asyncio.run_coroutine_threadsafe(self.on_wake(), self._loop)
                        time.sleep(1.0)  # debounce after trigger
                    else:
                        last_clap = now
            except Exception as e:
                print(f"[Listener] Error: {e}")
                time.sleep(0.05)

        stream.stop_stream()
        stream.close()

    def record_speech(self) -> bytes:
        """Blocking: record until silence. Call from executor thread."""
        pa = pyaudio.PyAudio()
        stream = pa.open(
            format=pyaudio.paInt16,
            channels=1,
            rate=RATE,
            input=True,
            frames_per_buffer=CHUNK,
        )
        frames = []
        silence_start: float | None = None
        total_chunks = 0
        max_chunks = int(RATE / CHUNK * MAX_RECORD_SECONDS)

        while total_chunks < max_chunks:
            data = stream.read(CHUNK, exception_on_overflow=False)
            frames.append(data)
            total_chunks += 1

            amplitude = int(np.abs(np.frombuffer(data, dtype=np.int16)).max())
            if amplitude < SILENCE_THRESHOLD:
                if silence_start is None:
                    silence_start = time.time()
                elif time.time() - silence_start >= SILENCE_DURATION:
                    break
            else:
                silence_start = None

        stream.stop_stream()
        stream.close()
        pa.terminate()

        # Pack into wav bytes
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(RATE)
            wf.writeframes(b"".join(frames))
        return buf.getvalue()
