import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
from pathlib import Path
from typing import Set

import uvicorn
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

from brain import process, process_stream, build_morning_brief
from listener import AudioListener
from stt import load_model, transcribe
import re
from tts import speak, enqueue, start_tts_engine, stop_tts_engine
from tools.location import get_location
from tools.memory import init_db, save_conversation, get_pending_reminders, get_recent_conversations
from tools.weather import get_weather

MEMORY_FILE = Path(__file__).parent / "db" / "memory.json"

import subprocess

SLEEP_PHRASES = {
    "sleep", "that's all", "goodnight", "goodbye", "go to sleep",
    "stand by", "dismiss", "stop listening", "that will be all",
    "thanks that's all", "thank you that's all",
}

connected_clients: Set[WebSocket] = set()
_context: dict = {}
_interaction_lock = asyncio.Lock()
_morning_briefed = False
_evening_briefed = False
_session_history: list[dict] = []


# ---- Memory (JSON) -------------------------------------------------------

PORTFOLIO_DIR = os.getenv("PORTFOLIO_DIR", r"C:\Users\shish\Desktop\PORTFOLIO")
ORION_DIR = os.path.join(PORTFOLIO_DIR, "ORION")

_widget_blur_task: asyncio.Task | None = None
_current_state: str = "idle"


def _pop_sentences(buffer: str) -> tuple[list[str], str]:
    """Extract complete sentences from buffer, return (sentences, remaining)."""
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z"\'])', buffer)
    if len(parts) > 1:
        complete = [p.strip() for p in parts[:-1] if p.strip() and len(p.strip()) > 3]
        return complete, parts[-1]
    return [], buffer


def _is_tweet_content(text: str) -> bool:
    t = text.upper()
    return "[TWEET]" in t or "[/TWEET]" in t


def _extract_tweet(response: str) -> tuple[str, str | None]:
    """Returns (cleaned_response, tweet_text_or_None)."""
    match = re.search(r'\[TWEET\](.*?)\[/TWEET\]', response, re.DOTALL | re.IGNORECASE)
    if match:
        tweet = match.group(1).strip()
        cleaned = re.sub(r'\[TWEET\].*?\[/TWEET\]', '', response, flags=re.DOTALL | re.IGNORECASE).strip()
        return cleaned, tweet
    return response, None


def _detect_widget(user_text: str, response: str) -> tuple[str | None, dict]:
    combined = (user_text + " " + response).lower()

    if any(w in combined for w in ["weather", "temperature", "°c", "forecast", "rain", "sunny", "humid", "wind", "feels like"]):
        return "weather", {}

    if any(w in combined for w in ["commit", "git log", "pushed", "shipped", "deployed", "branch", "what did i push", "recent commits"]):
        try:
            result = subprocess.run(
                ["git", "-C", ORION_DIR, "log", "--oneline", "-8", "--format=%h %s (%cr)"],
                capture_output=True, text=True, timeout=3
            )
            commits = [l for l in result.stdout.strip().split("\n") if l] if result.returncode == 0 else []
            return "git", {"commits": commits}
        except Exception:
            return "git", {"commits": []}

    if any(w in combined for w in ["news", "headline", "happened today", "what's happening", "latest"]):
        return "news", {}

    return None, {}


async def _schedule_widget_blur(delay: float = 12.0):
    global _widget_blur_task
    if _widget_blur_task and not _widget_blur_task.done():
        _widget_blur_task.cancel()
    async def _blur():
        await asyncio.sleep(delay)
        await broadcast({"type": "widget_blur"})
    _widget_blur_task = asyncio.create_task(_blur())


def _load_memory() -> list[dict]:
    try:
        if MEMORY_FILE.exists():
            data = json.loads(MEMORY_FILE.read_text())
            return data.get("conversations", [])[-100:]
    except Exception:
        pass
    return []


def _save_memory(entry: dict):
    try:
        MEMORY_FILE.parent.mkdir(exist_ok=True)
        data = {"conversations": _load_memory() + [entry]}
        data["conversations"] = data["conversations"][-200:]
        MEMORY_FILE.write_text(json.dumps(data, indent=2))
    except Exception as e:
        print(f"[Memory] Save error: {e}")


# ---- WebSocket broadcast --------------------------------------------------

async def broadcast(payload: dict):
    dead = set()
    for ws in list(connected_clients):
        try:
            await ws.send_json(payload)
        except Exception:
            dead.add(ws)
    for ws in dead:
        connected_clients.discard(ws)


async def set_state(state: str):
    global _current_state
    _current_state = state
    print(f"[ORION] State -> {state}")
    await broadcast({"type": "state", "state": state})


# ---- Core interaction pipeline --------------------------------------------

async def handle_interaction(source: str = "clap"):
    global _session_history

    async with _interaction_lock:
        consecutive_silences = 0

        try:
            while True:
                # Silent listen - no "yes boss?" prompt
                await set_state("listening")

                loop = asyncio.get_event_loop()
                wav_bytes = await loop.run_in_executor(None, listener.record_speech)

                if not wav_bytes or len(wav_bytes) < 1000:
                    consecutive_silences += 1
                    if consecutive_silences >= 2:
                        return
                    continue

                consecutive_silences = 0
                await set_state("thinking")
                user_text = await transcribe(wav_bytes)

                if not user_text.strip():
                    consecutive_silences += 1
                    if consecutive_silences >= 2:
                        return
                    continue

                # Dismiss phrases - silently return to idle
                lower = user_text.lower().strip().rstrip(".")
                if any(phrase in lower for phrase in SLEEP_PHRASES):
                    return

                # Broadcast user turn
                _session_history.append({"role": "user", "content": user_text})
                _save_memory({"timestamp": datetime.now().isoformat(), "role": "user", "content": user_text})
                await save_conversation("user", user_text)
                await broadcast({"type": "transcript", "role": "user", "content": user_text})

                # Stream response - TTS starts on first complete sentence, no waiting
                full_response = ""
                buffer = ""
                tts_events: list[asyncio.Event] = []
                speaking_started = False

                async for chunk in process_stream(user_text, _context, _session_history):
                    buffer += chunk
                    full_response += chunk
                    sentences, buffer = _pop_sentences(buffer)
                    for sentence in sentences:
                        if sentence and not _is_tweet_content(sentence):
                            if not speaking_started:
                                await set_state("speaking")
                                speaking_started = True
                            tts_events.append(enqueue(sentence, loop))

                # Flush remaining buffer
                if buffer.strip() and not _is_tweet_content(buffer):
                    if not speaking_started:
                        await set_state("speaking")
                    tts_events.append(enqueue(buffer.strip(), loop))

                full_response = full_response.strip() or "I ran into an issue, boss."
                full_response, tweet_text = _extract_tweet(full_response)

                # Log + broadcast ORION turn
                _session_history.append({"role": "orion", "content": full_response})
                _save_memory({"timestamp": datetime.now().isoformat(), "role": "orion", "content": full_response})
                await save_conversation("orion", full_response)
                await broadcast({"type": "transcript", "role": "orion", "content": full_response})

                # Widget focus: tweet takes priority, then keyword detection
                if tweet_text:
                    await broadcast({"type": "widget_focus", "widget": "tweet", "data": {"text": tweet_text}})
                    await _schedule_widget_blur(20.0)
                else:
                    widget, data = _detect_widget(user_text, full_response)
                    if widget:
                        await broadcast({"type": "widget_focus", "widget": widget, "data": data})
                        await _schedule_widget_blur(12.0)

                # Mute listener while TTS plays so speaker audio can't retrigger
                if tts_events:
                    listener.muted = True
                    await tts_events[-1].wait()
                    listener.muted = False
                # Loop back to silent listening

        except Exception as e:
            import traceback
            print(f"[ORION] Interaction error: {e}")
            traceback.print_exc()
            await broadcast({
                "type": "transcript", "role": "orion",
                "content": "Something went wrong on my end, boss."
            })
        finally:
            await set_state("idle")


# ---- Context refresh ------------------------------------------------------

async def refresh_context():
    global _context
    try:
        location = await get_location()
        city = location.get("city", "Delhi")
        weather = await get_weather(city)
        reminders = await get_pending_reminders()
        _context = {
            "city": city,
            "country": location.get("country", "India"),
            "latitude": location.get("latitude"),
            "longitude": location.get("longitude"),
            "weather_summary": weather.get("summary", ""),
            "weather": weather,
            "pending_reminders": reminders,
        }
        await broadcast({"type": "weather", "data": weather})
        await broadcast({"type": "location", "data": {"city": city, "country": location.get("country", "")}})
        print(f"[Context] {city} | {weather.get('summary', '')}")
    except Exception as e:
        print(f"[Context] Refresh error: {e}")


# ---- Proactive briefings --------------------------------------------------

async def maybe_morning_brief():
    global _morning_briefed
    hour = datetime.now().hour
    if 6 <= hour <= 10 and not _morning_briefed:
        _morning_briefed = True
        try:
            brief = await build_morning_brief(_context)
            await save_conversation("orion", brief)
            await broadcast({"type": "transcript", "role": "orion", "content": brief})
            await set_state("speaking")
            listener.muted = True
            await speak(brief)
            listener.muted = False
        except Exception as e:
            print(f"[Morning Brief] Error: {e}")
        finally:
            listener.muted = False
            await set_state("idle")


async def maybe_evening_wrap():
    global _evening_briefed
    hour = datetime.now().hour
    if hour == 22 and not _evening_briefed:
        _evening_briefed = True
        try:
            recent = _session_history[-10:] if _session_history else []
            wrap = await process(
                "Give Sanidhya a brief end-of-day wrap-up. Check what was built today with git log. "
                "Mention any pending reminders. 3 sentences max, JARVIS style.",
                _context, recent
            )
            await save_conversation("orion", wrap)
            await broadcast({"type": "transcript", "role": "orion", "content": wrap})
            await set_state("speaking")
            listener.muted = True
            await speak(wrap)
            listener.muted = False
        except Exception as e:
            print(f"[Evening Wrap] Error: {e}")
        finally:
            listener.muted = False
            await set_state("idle")


# ---- Amplitude broadcasting ----------------------------------------------

async def amplitude_broadcaster():
    """Reads mic amplitude from listener and broadcasts only while the UI
    actually uses it (listening / speaking). At idle the waveform is flat,
    so streaming amplitude just wastes CPU on both ends."""
    last_sent = 0
    while True:
        if _current_state in ("listening", "speaking") and connected_clients:
            amp = int(listener.current_amplitude)
            # Skip near-duplicate values to cut React re-renders.
            if abs(amp - last_sent) > 150:
                last_sent = amp
                await broadcast({"type": "amplitude", "value": amp})
            await asyncio.sleep(0.16)  # ~6fps active
        else:
            await asyncio.sleep(0.5)


# ---- Periodic tasks -------------------------------------------------------

async def periodic_tasks():
    last_interaction = datetime.now()

    while True:
        await asyncio.sleep(60)
        now = datetime.now()

        if now.minute % 10 == 0:
            await refresh_context()

        await maybe_morning_brief()
        await maybe_evening_wrap()

        if now.hour == 0 and now.minute == 0:
            global _morning_briefed, _evening_briefed
            _morning_briefed = False
            _evening_briefed = False

        if 9 <= now.hour <= 22 and not _interaction_lock.locked():
            idle_min = (now - last_interaction).total_seconds() / 60
            if idle_min >= 90:
                last_interaction = now
                nudge = "Boss, you've been heads-down for 90 minutes. Consider taking a break."
                await broadcast({"type": "transcript", "role": "orion", "content": nudge})
                try:
                    listener.muted = True
                    await speak(nudge)
                except Exception:
                    pass
                finally:
                    listener.muted = False


# ---- Listener glue --------------------------------------------------------

async def on_wake():
    if not _interaction_lock.locked():
        asyncio.create_task(handle_interaction("wake"))


listener = AudioListener(on_wake=on_wake)


# ---- FastAPI lifespan -----------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    start_tts_engine()
    load_model()
    await refresh_context()

    loop = asyncio.get_event_loop()
    await asyncio.sleep(2)
    listener.start(loop)

    asyncio.create_task(periodic_tasks())
    asyncio.create_task(amplitude_broadcaster())

    print("[ORION] Online. Double clap, hold Space, or say 'wake up' to activate.")
    yield

    listener.stop()
    stop_tts_engine()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000", "http://localhost:3001",
        "http://127.0.0.1:3000", "http://127.0.0.1:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---- WebSocket endpoint ---------------------------------------------------

@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket):
    await websocket.accept()
    connected_clients.add(websocket)

    if _context.get("weather"):
        await websocket.send_json({"type": "weather", "data": _context["weather"]})
    if _context.get("city"):
        await websocket.send_json({"type": "location", "data": {
            "city": _context["city"], "country": _context.get("country", ""),
        }})
    await websocket.send_json({"type": "state", "state": "idle"})
    asyncio.create_task(maybe_morning_brief())

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "trigger":
                if not _interaction_lock.locked():
                    asyncio.create_task(handle_interaction("manual"))

            elif msg_type == "set_threshold":
                value = int(data.get("value", 3500))
                listener.clap_threshold = max(500, min(8000, value))
                print(f"[ORION] Clap threshold set to {listener.clap_threshold}")

            elif msg_type == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        connected_clients.discard(websocket)
    except Exception as e:
        print(f"[WS] Client error: {e}")
        connected_clients.discard(websocket)


@app.get("/health")
async def health():
    return {
        "status": "online",
        "city": _context.get("city"),
        "weather": _context.get("weather_summary"),
    }


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
