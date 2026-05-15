# ORION - Personal AI Assistant

JARVIS for Sanidhya. Voice-first, locally-run, always-on.

## Quick Start

### Backend
```bash
cd backend
pip install -r requirements.txt
cp .env.example .env  # add your ANTHROPIC_API_KEY
python main.py
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:3000

## Wake
- Double clap
- Press Ctrl+Space (coming in v0.4)
- Click the orb on the dashboard

## Stack
- Backend: Python, FastAPI, faster-whisper, edge-tts, Claude Agent SDK
- Frontend: Next.js 15, Framer Motion, Zustand, TailwindCSS
