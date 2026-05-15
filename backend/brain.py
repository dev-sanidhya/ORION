import asyncio
import os
import json
from datetime import datetime
from claude_code_sdk import query, ClaudeCodeOptions
from claude_code_sdk.types import AssistantMessage, TextBlock, ResultMessage

MODEL = os.getenv("ORION_MODEL", "claude-haiku-4-5")

PORTFOLIO_DIR = os.getenv("PORTFOLIO_DIR", r"C:\Users\shish\Desktop\PORTFOLIO")
ORION_DIR = os.path.join(PORTFOLIO_DIR, "ORION")

SYSTEM_PROMPT = f"""You are ORION, Sanidhya Shishodia's personal AI assistant - like JARVIS from Iron Man.
Speak in his voice: calm, precise, dry wit, slightly formal. Address him as "boss" or "sir".

PERSONALITY RULES:
- Be concise. 1-3 sentences for voice delivery unless asked to elaborate.
- Never say "certainly", "of course", "absolutely", "great question". Sound like a person.
- Answer directly from context. Don't say "let me check" if the answer is in context.
- When doing multi-step tasks with tools, narrate briefly what you're doing.

COMPUTER CONTROL (use Bash tool on Windows):
- Open apps: `start <appname>` e.g. `start spotify`, `start chrome`, `start code`, `start notepad`
- Open URLs: `start https://youtube.com`
- Open Spotify URI: `start spotify:playlist:37i9dQZF1DX0SM0LYsmbMT`
- Volume: `nircmd.exe setsysvolume 65535` (max) or `nircmd.exe mutesysvolume 1`

CODE & GIT:
- Git log: `git -C "{PORTFOLIO_DIR}/ORION" log --oneline -10`
- Git log any project: `git -C "<path>" log --oneline --since=yesterday`
- Git status: `git -C "<path>" status --short`

TWEET DRAFTING:
- When asked to draft a tweet, write it clearly in your response between [TWEET] and [/TWEET] tags.
- Then say "Draft ready, boss. Want me to post it?"

MEMORY:
- Conversation history is provided in context. Reference it naturally.
- The memory file is at: {ORION_DIR}/backend/db/memory.json - you can Read it for older history.

IMPORTANT: You have Bash, Read, Glob, Grep, WebFetch, WebSearch tools available.
Use them proactively when the user asks for something that requires them.
For Windows commands, use `start` not `open`."""


def _build_prompt(user_message: str, context: dict, history: list) -> str:
    now = datetime.now()
    date_str = now.strftime("%A, %d %B %Y")
    time_str = now.strftime("%I:%M %p")

    city = context.get("city", "Delhi")
    weather_str = context.get("weather_summary", "weather unavailable")
    pending_reminders = context.get("pending_reminders", [])
    reminders_str = json.dumps(pending_reminders) if pending_reminders else "none"

    history_block = ""
    if history:
        lines = []
        for h in history[-6:]:
            prefix = "User" if h["role"] == "user" else "ORION"
            lines.append(f"{prefix}: {h['content']}")
        history_block = "\n[CONVERSATION HISTORY]\n" + "\n".join(lines) + "\n"

    return (
        f"[CONTEXT] {date_str} | {time_str} | {city} | {weather_str} | reminders: {reminders_str}"
        f"{history_block}\n"
        f"[USER] {user_message}"
    )


_SDK_OPTIONS = lambda: ClaudeCodeOptions(
    model=MODEL,
    system_prompt=SYSTEM_PROMPT,
    max_turns=5,
    allowed_tools=["Bash", "Read", "Glob", "Grep", "WebFetch", "WebSearch"],
    permission_mode="bypassPermissions",
    cwd=PORTFOLIO_DIR,
)


async def process_stream(user_message: str, context: dict, history: list = []):
    """Async generator - yields text chunks as each AssistantMessage arrives."""
    prompt = _build_prompt(user_message, context, history)
    async for msg in query(prompt=prompt, options=_SDK_OPTIONS()):
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock) and block.text.strip():
                    yield block.text
        elif isinstance(msg, ResultMessage):
            if msg.is_error:
                print(f"[Brain] SDK error: {msg}")


async def process(user_message: str, context: dict, history: list = []) -> str:
    parts = []
    async for chunk in process_stream(user_message, context, history):
        parts.append(chunk)
    result = " ".join(parts).strip()
    if not result:
        return "I ran into an issue processing that, boss."
    print(f"[Brain] {result[:100]}")
    return result


async def build_morning_brief(context: dict) -> str:
    city = context.get("city", "Delhi")
    weather = context.get("weather_summary", "")
    reminders = context.get("pending_reminders", [])
    reminder_text = f" Pending reminders: {len(reminders)}." if reminders else ""
    prompt = (
        f"Give a morning briefing. It's {datetime.now().strftime('%A %d %B')}. "
        f"Location: {city}. Weather: {weather}.{reminder_text} "
        f"Check git log for recent commits and mention what was last worked on. Keep it under 4 sentences."
    )
    return await process(prompt, context)
