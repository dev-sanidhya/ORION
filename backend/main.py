import asyncio
import json
import os
from contextlib import asynccontextmanager
from datetime import datetime
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
from tools.memory import init_db, save_conversation, get_pending_reminders
from tools.weather import get_weather

# ---- State ----------------------------------------------------------------

connected_clients: Set[WebSocket] = set()
_context: dict = {}
_interaction_lock = asyncio.Lock()
_morning_briefed = False
_evening_briefed = False


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
    async with _interaction_lock:
        try:
            await set_state("listening")
            await speak("Yes boss?")

            loop = asyncio.get_event_loop()
            wav_bytes = await loop.run_in_executor(None, listener.record_speech)

            if not wav_bytes or len(wav_bytes) < 1000:
                await set_state("idle")
                return

            await set_state("thinking")
            user_text = await transcribe(wav_bytes)

            if not user_text.strip():
                await speak("I didn't catch that, boss.")
                await set_state("idle")
                return

            await save_conversation("user", user_text)
            await broadcast({"type": "transcript", "role": "user", "content": user_text})

            response = await process(user_text, _context)

            await save_conversation("orion", response)
            await broadcast({"type": "transcript", "role": "orion", "content": response})

            await set_state("speaking")
            await speak(response)

        except Exception as e:
            print(f"[ORION] Interaction error: {e}")
            await broadcast({"type": "transcript", "role": "orion", "content": "Something went wrong on my end, boss."})

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
            prompt = (
                "Give Sanidhya a brief end-of-day wrap-up. Check what reminders are pending. "
                "Keep it under 3 sentences, JARVIS style. Mention what tomorrow looks like if there's any context."
            )
            wrap = await process(prompt, _context)
            await save_conversation("orion", wrap)
            await broadcast({"type": "transcript", "role": "orion", "content": wrap})
            await set_state("speaking")
            await speak(wrap)
        except Exception as e:
            print(f"[Evening Wrap] Error: {e}")
        finally:
            await set_state("idle")


# ---- Periodic tasks -------------------------------------------------------

async def periodic_tasks():
    last_focus_check = datetime.now()
    last_interaction = datetime.now()

    while True:
        await asyncio.sleep(60)  # check every minute
        now = datetime.now()

        # Context refresh every 10 minutes
        if now.minute % 10 == 0:
            await refresh_context()

        # Morning brief check
        await maybe_morning_brief()

        # Evening wrap check
        await maybe_evening_wrap()

        # Reset daily flags at midnight
        if now.hour == 0 and now.minute == 0:
            global _morning_briefed, _evening_briefed
            _morning_briefed = False
            _evening_briefed = False

        # Focus nudge - if no interaction for 90 min during working hours
        if 9 <= now.hour <= 22:
            idle_minutes = (now - last_interaction).total_seconds() / 60
            if idle_minutes >= 90:
                last_interaction = now  # reset so it doesn't spam
                nudge = "Boss, you've been heads-down for 90 minutes. Consider taking a break."
                await broadcast({"type": "transcript", "role": "orion", "content": nudge})
                try:
                    await speak(nudge)
                except Exception:
                    pass


# ---- Listener glue --------------------------------------------------------

async def on_wake():
    asyncio.create_task(handle_interaction("clap"))


listener = AudioListener(on_wake=on_wake)


# ---- FastAPI lifespan -----------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()

    # TTS engine must start before anything tries to speak
    start_tts_engine()

    # Load STT model (blocks ~5s on first run)
    load_model()

    # Fetch initial context
    await refresh_context()

    # Start clap listener after a 2s delay to avoid startup audio noise triggering it
    loop = asyncio.get_event_loop()
    await asyncio.sleep(2)
    listener.start(loop)

    # Start periodic tasks
    asyncio.create_task(periodic_tasks())

    print("[ORION] Online. Double clap or Ctrl+Space to activate.")
    yield

    listener.stop()
    stop_tts_engine()


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
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

    # Push current context immediately on connect
    if _context.get("weather"):
        await websocket.send_json({"type": "weather", "data": _context["weather"]})
    if _context.get("city"):
        await websocket.send_json({"type": "location", "data": {
            "city": _context["city"],
            "country": _context.get("country", ""),
        }})
    await websocket.send_json({"type": "state", "state": "idle"})

    # Trigger morning brief for this session if applicable
    asyncio.create_task(maybe_morning_brief())

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "trigger":
                if not _interaction_lock.locked():
                    asyncio.create_task(handle_interaction("manual"))

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
