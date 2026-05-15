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

**Phases 1-4 COMPLETE + v0.5 features shipped.**

**Latest changes (this session):**

### Streaming TTS (DONE)
- `brain.py` now has `process_stream()` - async generator yielding text chunks as each `AssistantMessage` arrives from the SDK
- `main.py` `handle_interaction()` pipes chunks into `_pop_sentences()` buffer, enqueues sentences for TTS the moment they're complete
- First sentence plays while the rest of the response is still streaming - no waiting for full SDK response
- Tweet content (between `[TWEET]` tags) is filtered from TTS automatically

### Silent Persistent Mode (DONE)
- No "Yes boss?" on activation - silently starts listening
- No "Standing by" prompt - just loops back to listening after each response
- Exits only on sleep phrases or 2 consecutive silences

### Fullscreen Widget Overlay (DONE)
- `frontend/components/WidgetOverlay.tsx` - fixed z-50 full-screen backdrop overlay
- Spring animation in, click-backdrop to dismiss early
- Weather: big temperature + all stats + summary
- Git: full commit list with hash / message / age
- Tweet: large draft + COPY & DISMISS button
- News: hints to look at the news panel
- Auto-dismisses via `widget_blur` event (12s/20s after ORION discusses it)
- Added to `page.tsx` as first child of `<main>`

### Architecture
- `brain.py`: `process_stream()` + `process()` (sync wrapper for briefings)
- `main.py`: `_pop_sentences()` buffer-based sentence extractor + `_is_tweet_content()` filter
- Frontend: `WidgetOverlay` renders on top of everything, fully independent of inline widgets

**Next up:**
- Test everything end-to-end (restart both servers)
- Typefully MCP integration for tweet drafting

---

## v0.6 - Scalability Pass (2026-05-15)

Laptop was hanging on start. Did a perf audit. Root causes + fixes:

### Backend (heaviest wins)
- **Continuous Whisper wake-phrase loop killed unless `ORION_WAKE_PHRASE=1`.**
  The listener used to run faster-whisper end-to-end every ~1s on rolling 2s clips.
  That alone pegged CPU/GPU. Now opt-in.
- **Local Whisper models are lazy-loaded.** When `GROQ_API_KEY` is set, tiny+small
  no longer load at all (saves ~1-2 GB RAM, several seconds of startup, no CUDA init).
  Set `ORION_LOCAL_STT=1` to force-load as offline fallback.
- **Dead `_audio_chunks` rolling buffer removed** - was holding 30s of PCM under
  a lock and never read.
- **Amplitude broadcaster gated to active states only.** Was 10fps regardless,
  now 6fps while listening/speaking, ~2Hz idle ticks, near-duplicate values
  suppressed. Stops the constant WS spam + React re-renders.
- **Mic amplitude decimated 3x** in the capture thread before writing to the
  shared state (UI never needed 64ms granularity).

### Frontend (paint/composite cost)
- **`backdrop-filter: blur(26-30px)` removed from all `.orion-panel` surfaces.**
  Was applied to ~7 large panels simultaneously - fullscreen GPU readback every
  frame. Replaced with solid translucent gradients.
- **Stacked `blur-3xl` gradient orbs removed** from page background + widget
  overlay. Replaced with cheap radial-gradient orbs that drift via `transform`
  only (no `filter`).
- **Waveform**: 28 framer-motion components at idle -> plain divs at idle.
  Container does one CSS `breathe` keyframe instead.
- **Orb**: animated `box-shadow` keyframes (worst offender, forces paint)
  removed. Rotating rings moved from framer-motion to pure CSS keyframes
  (`orion-spin-slow`, `orion-spin-rev`). Halo `breathe` is transform+opacity
  only - no animated `filter: blur()`.
- New cheap GPU primitives in `globals.css`: `orion-spin-slow`,
  `orion-spin-rev`, `orion-breathe`, `orion-shimmer`. Rule of thumb: transform
  + opacity only. No filter, no backdrop-filter, no animated box-shadow, no
  width/height keyframes.

### Mental model going forward
- Anything that runs every frame must use transform/opacity only.
- Anything that runs every audio chunk (~16ms) must not spawn a model.
- Anything that runs every WS message must not re-render 28 motion components.

---

## Feature Roadmap (cheap + high-leverage)

Constraint: laptop is the bottleneck. Pick features that add product surface
without adding per-frame or per-audio-chunk work.

### Tier 1 - cheap, high impact (next)
- **Typefully MCP for real tweet posting.** Replace "copy to clipboard" with
  one-click schedule-to-Typefully from the TweetOverlay. MCP already
  connected. Pure I/O - zero runtime cost.
- **Calendar widget**. Google Calendar via the gcal MCP (already connected).
  Show today's next 3 events in a new `CalendarCard` on the left rail.
  Refresh every 10 min in `periodic_tasks` - no per-frame cost.
- **Spotify "now playing" chip.** Spotify MCP already connected. Small text
  chip near the clock. Poll every 30s.
- **Conversation search.** Already storing in SQLite via `tools/memory.py`.
  Add a "search memory" tool to the brain so "what did I say about X last
  week" works. Pure DB query.
- **Daily X analytics digest** in morning brief. Recently-published tweets
  from Typefully + counts. One API call per morning.

### Tier 2 - feature breadth, still cheap
- **Pomodoro / focus timer.** Backend tracks session, broadcasts state.
  Frontend shows a thin CSS ring drain (transform-based) around the Orb.
  Zero per-frame JS.
- **Project switcher.** Multi-project context (PORTFOLIO has more than ORION).
  `git log` for the active project, swappable via voice ("ORION, switch to
  Vault"). Just a path swap + cached git output.
- **Notion daily log.** Notion MCP already connected. End-of-day wrap-up
  auto-writes to a daily log page. One API call per evening.
- **Email triage chip.** Gmail MCP - count unreads in important labels, surface
  in a chip. Poll every 5 min.
- **Linear / GitHub issue ticker** in the NewsStrip slot when no news. RSS or
  MCP-fetched, refresh every 5 min.

### Tier 3 - more ambitious but still GPU-cheap
- **Multi-display layouts.** Detect screen width, switch to a "wall mode"
  layout (giant orb + ticker) when on the external display, "cockpit mode" on
  laptop. Pure CSS.
- **Voice notes -> ideas DB.** Say "ORION, idea: ...". Brain extracts and
  appends to a Notion ideas database via MCP. Searchable later via memory tool.
- **Reading list.** Tab snapshot to a Notion/sqlite list with summaries
  (Claude). One Claude call per save.
- **Screenshot OCR + commentary.** Press a hotkey -> screenshot -> Claude
  vision describes / answers questions. Manual trigger only, so cost is
  bounded.
- **Wake-word via porcupine instead of Whisper.** Picovoice porcupine runs in
  ~1% CPU on a fixed wakeword model - way cheaper than rolling Whisper.
  Single-purpose audio classifier, no transcription. Would let us re-enable
  wake-word by default without the hang.

### Explicitly NOT doing now
- Real-time vision pipeline (camera-on always).
- Local LLM (use Claude via cloud - free local would burn the laptop again).
- Always-on screen-capture context (replace with manual hotkey trigger).

---

**Current state: v0.6, idle CPU should be <5% backend, frontend GPU much
lower. Motion preserved via CSS-only transforms.**

---

## v0.7 - Tier 1 features + Porcupine (2026-05-15)

Shipped all 🟢 "Free" features from the roadmap plus Porcupine wake-word.

### Backend
- **`tools/typefully.py`** - `create_draft()`, `recently_published()`.
  One HTTP call per action, no background polling.
- **`tools/notion.py`** - `append_daily_log()`, `append_idea()`. Auto-retries
  without optional Note column if user's schema differs.
- **`tools/calendar.py`** - parses Google Calendar private ICS URL.
  10-min cache, fetch on demand or via periodic_tasks.
- **`tools/projects.py`** - active project stored in SQLite facts table,
  switches on user request. `list_projects()` walks PORTFOLIO_DIR.
- **`tools/memory.py`** - added `search_conversations(query, limit, days)`.
- **`tools/porcupine.py`** - wake-word detector, ~1% CPU.
- **`listener.py`** - Porcupine frame-by-frame in the audio thread, runs
  alongside clap detection. Old whisper wake-loop still there but opt-in.
- **`main.py`** - regex side-channels in `handle_interaction` for:
    - "idea: ..." -> auto-saves to Notion ideas DB
    - "switch to <project>" -> changes active project + broadcasts
  Plus new WS messages: `post_tweet`, `set_project`, `search_memory`,
  `refresh_calendar`.
- **Morning brief** now includes recent Typefully tweets as context.
- **Evening wrap** writes a Notion daily log page (commits + tweets + summary).
- Active project is now used everywhere instead of hardcoded ORION (git
  widget, evening commits, etc.).

### Frontend
- **`CalendarCard`** - left rail. Shows next 4 events in 24h window with
  relative day + time + location. Empty state when nothing's scheduled.
- **`ProjectSwitcher`** - dropdown in the header next to the Config button.
  Shows active project with a shimmer dot, dropdown lists other PORTFOLIO
  repos.
- **`ToastStack`** - bottom-right ephemeral toasts. Triggered by backend
  `toast` events (idea saved, tweet scheduled, project switched).
- **TweetOverlay** - now has a primary "Schedule to Typefully" button +
  secondary Copy fallback. Wires through WS `post_tweet`.
- **Wall mode** - pure CSS media query. At 1920px+ the Orb scales 1.18x,
  at 2400px+ it scales 1.4x. Zero JS cost.
- **Socket** - new methods: `postTweet`, `setProject`, `searchMemory`,
  `refreshCalendar`.
- **Store** - added calendar, activeProject, availableProjects, toasts,
  memoryQuery, memoryResults fields with their setters.

### Required env vars (drop in `backend/.env`)
```
# Wake-word (Porcupine) - free tier
PORCUPINE_ACCESS_KEY=...
PORCUPINE_KEYWORD=jarvis           # built-in, or use:
# PORCUPINE_KEYWORD_PATH=wake/hey-orion.ppn

# Tweet posting
TYPEFULLY_API_KEY=...

# Notion daily log + ideas
NOTION_TOKEN=...
NOTION_DAILY_DB_ID=...
NOTION_IDEAS_DB_ID=...

# Google Calendar (private ICS URL from calendar settings)
GCAL_ICS_URL=https://calendar.google.com/calendar/ical/.../basic.ics
```

Features without keys stay silent (no crash), so partial config is fine.

### Voice triggers for ideas / project switching
- "Idea: build a JARVIS wall display in a vintage TV frame" -> Notion
- "Save this idea: launch product on March 1" -> Notion
- "ORION, switch to Vault" -> changes active project, git widget follows

### Next up
- Pomodoro / focus timer ring (Tier 2 #6)
- Gmail unread chip (Tier 2 #9)
- Spotify now playing (Tier 1 #3 - skipped in this batch; needs OAuth flow,
  will revisit)

---

## v0.7.1 - Removed Porcupine + Notion (2026-05-15)

Sanidhya can't get a Picovoice AccessKey (no company email), and explicitly
asked to drop Notion. Both ripped:

### Removed
- `backend/tools/porcupine.py` deleted
- `backend/tools/notion.py` deleted
- `pvporcupine` from requirements.txt
- Porcupine frame loop in `listener.py`
- Notion import + idea-capture side-channel in `main.py`
- Notion daily-log write in evening wrap
- IDEAS CAPTURE block from brain.py system prompt

### What still works
- Calendar widget (Google Calendar ICS, no OAuth)
- Typefully tweet posting + analytics in morning brief
- Project switcher ("ORION, switch to <name>")
- Memory search via WS
- Multi-display wall mode
- Toast stack (used by Typefully posting + project switching)
- Clap + hold-Space + opt-in Whisper wake-phrase (`ORION_WAKE_PHRASE=1`)

### Open question: wake-word replacement
Porcupine was the recommended approach because of CPU footprint. Pending
Sanidhya's choice, candidates without account/API requirements:
- **openWakeWord** (MIT, no account, ONNX models, pre-trained "Hey Jarvis"
  included). Cheap. Drop-in replacement.
- **Sherpa-onnx keyword spotter** (also no account, lighter than Whisper).
- Stay with clap + Space only.

Recommendation: openWakeWord. Roughly the same CPU profile as Porcupine.
- openwakeword "Hey ORION" hotword
