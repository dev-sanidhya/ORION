# ORION - AI Personal Assistant (JARVIS for Sanidhya)

**GitHub:** github.com/dev-sanidhya/ORION  
**Status:** Planning  
**Last Updated:** 2026-05-15

---

## What This Is

ORION is a locally-running personal AI assistant modeled after JARVIS from Iron Man. It wakes on a clap (or hotword), speaks back in voice, shows a live dashboard on a monitor, and has full context about Sanidhya - location, weather, calendar, active projects, X activity, and conversation history.

Built entirely on free/local tooling + Claude Agent SDK. Zero subscription cost beyond Claude API.

---

## Tech Stack

### Backend (Python - FastAPI)
- **Wake word / clap detection:** `pyaudio` + amplitude threshold (clap) OR `openwakeword` (hotword "Hey ORION")
- **Speech-to-Text:** `faster-whisper` (runs locally on CUDA/CPU, no latency, no cost)
- **AI Brain:** Claude Agent SDK (`claude-sonnet-4-6`) with tool use
- **Text-to-Speech:** `edge-tts` (Microsoft Edge neural voices, British male = "en-GB-RyanNeural", free, streams)
- **Weather:** Open-Meteo API (no key, completely free)
- **Location:** IP geolocation via `ipapi.co` (free) + manual override
- **Memory / Conversation log:** SQLite via `aiosqlite`
- **Realtime bridge to frontend:** WebSockets (`websockets` lib)
- **Computer control:** computer-use MCP (already connected)

### Frontend (Next.js 15)
- **Framework:** Next.js 15 App Router, TypeScript, TailwindCSS
- **Animations:** Framer Motion (arc reactor orb, waveform)
- **Voice on frontend:** Web Speech API for browser-side STT fallback
- **Widgets:** Weather card, clock, calendar, active project, X stats, news feed
- **State:** Zustand (lightweight, no boilerplate)
- **WebSocket client:** native browser WebSocket to Python backend

---

## Architecture Diagram

```
[CLAP / HOTWORD]
      |
      v
[Python Backend - FastAPI]
      |
      |-- pyaudio listener detects trigger
      |-- faster-whisper transcribes speech
      |-- Claude Agent SDK processes intent
      |        |-- Tool: get_weather (Open-Meteo)
      |        |-- Tool: get_location (ipapi.co)
      |        |-- Tool: read_memory (SQLite)
      |        |-- Tool: write_memory (SQLite)
      |        |-- Tool: get_news (RSS feeds)
      |        |-- Tool: git_log (subprocess)
      |        |-- Tool: computer_control (computer-use MCP)
      |        |-- Tool: draft_tweet (Typefully MCP)
      |        |-- Tool: get_calendar (local .ics / Google)
      |-- edge-tts streams audio response
      |-- WebSocket pushes state to frontend
      |
      v
[Next.js Dashboard - Browser]
      |
      |-- Arc reactor orb (pulses on listening/speaking)
      |-- Live weather card
      |-- Clock + date
      |-- Active project tile (from Plan.md)
      |-- Conversation transcript
      |-- News feed strip
      |-- X stats widget
      |-- Voice amplitude waveform
```

---

## Directory Structure

```
ORION/
  backend/
    main.py                   # FastAPI app, WebSocket server
    listener.py               # Clap/hotword detection, mic loop
    stt.py                    # faster-whisper STT
    tts.py                    # edge-tts streaming
    brain.py                  # Claude Agent SDK orchestrator
    tools/
      weather.py              # Open-Meteo fetch
      location.py             # ipapi.co
      memory.py               # SQLite read/write
      news.py                 # RSS feed parser
      git_tools.py            # git log, status via subprocess
      calendar_tools.py       # .ics or Google Calendar
    db/
      orion.db                # SQLite (auto-created)
    requirements.txt
  frontend/
    app/
      page.tsx                # Dashboard root
      layout.tsx
    components/
      Orb.tsx                 # Arc reactor orb with Framer Motion
      WeatherCard.tsx
      ClockWidget.tsx
      ProjectTile.tsx
      NewsStrip.tsx
      XStatsWidget.tsx
      Waveform.tsx
      TranscriptFeed.tsx
    lib/
      socket.ts               # WebSocket client singleton
      store.ts                # Zustand store
    package.json
  Plan.md
  README.md
```

---

## Claude Agent Tools (defined in brain.py)

| Tool | Description | Data Source |
|------|-------------|-------------|
| `get_weather` | Current + forecast for location | Open-Meteo (free) |
| `get_location` | Current city/coords | ipapi.co (free) |
| `get_news` | Top headlines by category | BBC/Reuters/HN RSS |
| `read_memory` | Last N conversations or named facts | SQLite |
| `write_memory` | Save a fact or reminder | SQLite |
| `get_active_project` | Read Plan.md of current project | filesystem |
| `git_log` | Recent commits across projects | subprocess git |
| `draft_tweet` | Create tweet draft | Typefully MCP |
| `open_app` | Open application on Windows | computer-use MCP |
| `get_calendar` | Today's events | local .ics |
| `set_reminder` | Schedule a reminder | SQLite + cron |

---

## System Prompt (loaded into every Claude call)

```
You are ORION, Sanidhya's personal AI assistant. You speak like JARVIS from Iron Man - 
calm, precise, dry wit, slightly formal, address him as "boss". 
You are concise: 2-3 sentences max unless asked to elaborate.
You have full context: his location is {city}, current time is {time}, weather is {weather}.
His active project is {active_project}. Keep responses short for voice delivery.
Never say "certainly" or "of course". Sound like a person, not a chatbot.
```

---

## Frontend Dashboard Layout

```
+--------------------------------------------------+
|  [ORION]                     15 May | 09:47 AM  |
|                                                  |
|         [  ARC REACTOR ORB  ]                    |
|         (pulsing animation)                      |
|         "Listening..." / "Speaking..."           |
|                                                  |
|  +---------------+  +------------------------+  |
|  | WEATHER       |  | ACTIVE PROJECT         |  |
|  | Delhi, 38C    |  | ORION - Planning       |  |
|  | Clear, hazy   |  | Next: Implement STT    |  |
|  +---------------+  +------------------------+  |
|                                                  |
|  +---------------+  +------------------------+  |
|  | X TODAY       |  | NEWS                   |  |
|  | 7 tweets      |  | - Headline 1           |  |
|  | 3 replies     |  | - Headline 2           |  |
|  +---------------+  +------------------------+  |
|                                                  |
|  [TRANSCRIPT]                                    |
|  > You: what's the weather                       |
|  > ORION: Delhi is 38 degrees...                 |
+--------------------------------------------------+
```

---

## Wake Modes

| Trigger | How |
|---------|-----|
| Double clap | `pyaudio` amplitude spike x2 within 800ms |
| "Hey ORION" | `openwakeword` model (optional, more accurate) |
| Keyboard shortcut | `keyboard` lib, hotkey `Ctrl+Space` |
| Dashboard button | Click orb on frontend |

Default v1: double clap + keyboard shortcut. openwakeword optional.

---

## Voice Pipeline (latency target: under 2s)

```
Clap detected       -> 0ms
STT (faster-whisper) -> ~400ms (local CUDA)
Claude Agent SDK    -> ~800ms (streaming)
edge-tts stream     -> first audio chunk ~200ms
                    -----------
Total perceived lag -> ~1.4s
```

Streaming TTS: pipe Claude output chunks directly to edge-tts as they arrive, do not wait for full response.

---

## Proactive Briefings (scheduled in Python)

| Time | Trigger | Content |
|------|---------|---------|
| First speech after 6 AM | Morning brief | Date, weather, plan for today, news summary |
| 10 PM daily | Evening wrap | What you shipped, reminders, tomorrow preview |
| After 90min silence | Focus break | Nudge to take a break |

---

## Memory Schema (SQLite)

```sql
conversations (
  id INTEGER PRIMARY KEY,
  timestamp TEXT,
  role TEXT,           -- 'user' or 'orion'
  content TEXT,
  session_id TEXT
)

facts (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE,     -- e.g. 'home_city', 'last_project'
  value TEXT,
  updated_at TEXT
)

reminders (
  id INTEGER PRIMARY KEY,
  content TEXT,
  remind_at TEXT,
  done INTEGER DEFAULT 0
)
```

---

## Phase Plan

### Phase 1 - Core Loop (v0.1) [COMPLETE]
- [x] Project scaffolding (backend + frontend dirs, requirements, package.json)
- [x] `listener.py` - double clap detection via pyaudio + silence-based recording
- [x] `stt.py` - faster-whisper transcription (CUDA with CPU fallback)
- [x] `brain.py` - Claude Agent SDK with weather + location + memory tools
- [x] `tts.py` - edge-tts streaming playback via pygame (voice: en-GB-RyanNeural)
- [x] `main.py` - FastAPI + WebSocket server with lifespan startup
- [x] Next.js dashboard: arc reactor orb, clock, weather card, transcript feed
- [x] WebSocket connection frontend <-> backend with auto-reconnect
- [x] SQLite memory (conversations, facts, reminders)
- [x] Context pre-loading (location + weather injected into system prompt)
- [x] Morning briefing trigger (auto-plays 6-10 AM on first interaction)

**Shipped:** Clap -> "Yes boss?" -> listen -> transcribe -> Claude with full context -> voice response + dashboard update.

**To run:**
1. Add `ANTHROPIC_API_KEY` to `backend/.env`
2. `cd backend && python main.py`
3. `cd frontend && npm run dev`
4. Open http://localhost:3000

### Phase 2 - Context & Memory (v0.2) [COMPLETE]
- [x] SQLite memory (conversations + facts + reminders)
- [x] Weather card widget on dashboard
- [x] Active project tile
- [x] Morning briefing trigger (6-10 AM)
- [x] Reminder system (add/read via voice)
- [x] News RSS feed tool (BBC top/tech/india + HN)

### Phase 3 - Power Features (v0.3) [COMPLETE]
- [x] git_log tool (reads recent commits via subprocess)
- [x] News strip frontend widget with category tabs
- [x] Waveform amplitude visualizer (animated per state)
- [x] Keyboard shortcut Ctrl+Space to trigger
- [ ] Draft tweet via Typefully MCP (Phase 5)
- [ ] Computer control via computer-use MCP (Phase 5)

### Phase 4 - Polish (v0.4) [COMPLETE]
- [x] Evening wrap-up briefing (10 PM auto)
- [x] Focus break nudge (90 min idle during work hours)
- [x] Settings panel (city override, backend status)
- [x] CORS fix for all localhost ports
- [x] pyttsx3 TTS (fully offline, replaces edge-tts that 403'd)
- [x] 2s startup delay before clap listener to avoid boot noise
- [ ] openwakeword "Hey ORION" hotword (Phase 5)

---

## Key Decisions

- **No paid APIs in v1.** Open-Meteo for weather, ipapi.co for location, RSS for news, local whisper for STT, edge-tts for voice.
- **Python backend, not Node.** pyaudio and faster-whisper are Python-native. FastAPI bridges to Next.js via WebSocket.
- **SQLite not cloud DB.** Local-first, no latency, no cost, private.
- **Streaming TTS matters.** Don't buffer full Claude response - pipe chunks to tts as they arrive.
- **Computer-use MCP already connected** - use it for app control, don't reinvent.
- **Typefully MCP already connected** - tweet drafting is one tool call away.

---

## Current Session State

**Phases 1-4 COMPLETE + STT upgrade** - Full system operational with Groq STT.

**Key fixes applied:**
- TTS switched to pyttsx3 (edge-tts was 403ing from India)
- CORS allows localhost:3000 and :3001
- Location override via ORION_CITY env var (Aligarh)
- Startup 2s delay before clap listener to avoid boot noise
- Single PyAudio() instance prevents PortAudio segfault
- Sequential STT model loading prevents CUDA double-init crash
- "wake up" voice trigger + long-press Space added
- Groq whisper-large-v3-turbo as primary STT (free tier, much better accuracy)
- tiny whisper for wake phrase, small for local fallback only

**System boots cleanly showing:**
```
[STT] Groq ready (whisper-large-v3-turbo)
[STT] Wake model ready
[STT] Main model (small) ready
[ORION] Listeners active: double-clap | say 'wake up' | hold Space
[Keyboard] Long-press Space active
[Audio] Capture thread started
```

**Next up (Phase 5):**
- Typefully MCP integration for tweet drafting
- openwakeword "Hey ORION" hotword
- Computer control via computer-use MCP
- X analytics widget
