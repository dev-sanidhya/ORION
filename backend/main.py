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

from brain import process, build_morning_brief
from listener import AudioListener
from stt import load_model, transcribe
from tts import speak, start_tts_engine, stop_tts_engine
from tools.location import get_location
from tools.memory import init_db, save_conversation, get_pending_reminders, get_recent_conversations
from tools.weather import get_weather

MEMORY_FILE = Path(__file__).parent / "db" / "memory.json"

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
    for ws in connected_clients:
        try:
            await ws.send_json(payload)
        except Exception:
            dead.add(ws)
    for ws in dead:
        connected_clients.discard(ws)


async def set_state(state: str):
    print(f"[ORION] State -> {state}")
    await broadcast({"type": "state", "state": state})


# ---- Core interaction pipeline --------------------------------------------

async def handle_interaction(source: str = "clap"):
    global _session_history

    async with _interaction_lock:
        first_turn = True
        consecutive_silences = 0

        try:
            while True:
                await set_state("listening")

                if first_turn:
                    await speak("Yes boss?")
                    first_turn = False

                loop = asyncio.get_event_loop()
                wav_bytes = await loop.run_in_executor(None, listener.record_speech)

                if not wav_bytes or len(wav_bytes) < 1000:
                    consecutive_silences += 1
                    if consecutive_silences >= 2:
                        await set_state("idle")
                        return
                    continue

                consecutive_silences = 0
                await set_state("thinking")
                user_text = await transcribe(wav_bytes)

                if not user_text.strip():
                    consecutive_silences += 1
                    if consecutive_silences >= 2:
                        await set_state("idle")
                        return
                    continue

                # Check sleep/dismiss phrases
                lower = user_text.lower().strip().rstrip(".")
                if any(phrase in lower for phrase in SLEEP_PHRASES):
                    await set_state("speaking")
                    await speak("Standing by, sir.")
                    await set_state("idle")
                    return

                # Log + broadcast user turn
                _session_history.append({"role": "user", "content": user_text})
                entry = {"timestamp": datetime.now().isoformat(), "role": "user", "content": user_text}
                _save_memory(entry)
                await save_conversation("user", user_text)
                await broadcast({"type": "transcript", "role": "user", "content": user_text})

                # Get response
                response = await process(user_text, _context, _session_history)

                # Log + broadcast ORION turn
                _session_history.append({"role": "orion", "content": response})
                _save_memory({"timestamp": datetime.now().isoformat(), "role": "orion", "content": response})
                await save_conversation("orion", response)
                await broadcast({"type": "transcript", "role": "orion", "content": response})

                await set_state("speaking")
                await speak(response)
                # Stay in session - loop back to listening

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
            await speak(brief)
        except Exception as e:
            print(f"[Morning Brief] Error: {e}")
        finally:
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
            await speak(wrap)
        except Exception as e:
            print(f"[Evening Wrap] Error: {e}")
        finally:
            await set_state("idle")


# ---- Amplitude broadcasting ----------------------------------------------

async def amplitude_broadcaster():
    """Reads mic amplitude from listener and broadcasts at ~10fps."""
    while True:
        await asyncio.sleep(0.1)
        amp = listener.current_amplitude
        if connected_clients:
            await broadcast({"type": "amplitude", "value": int(amp)})


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
                    await speak(nudge)
                except Exception:
                    pass


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
