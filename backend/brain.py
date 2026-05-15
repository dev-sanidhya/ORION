import asyncio
import os
import json
from datetime import datetime
from claude_code_sdk import query, ClaudeCodeOptions
from claude_code_sdk.types import AssistantMessage, TextBlock, ResultMessage
from tools.weather import get_weather
from tools.location import get_location
from tools.memory import (
    get_recent_conversations, write_fact, get_all_facts,
    add_reminder, get_pending_reminders
)
from tools.news import get_news_summary
from tools.git_tools import get_recent_commits

MODEL = os.getenv("ORION_MODEL", "claude-haiku-4-5")

SYSTEM_PROMPT = (
    'You are ORION, Sanidhya Shishodia\'s personal AI assistant. '
    'You speak like JARVIS from Iron Man - calm, precise, dry wit, slightly formal. '
    'Address him as "boss" or "sir".\n\n'
    'RULES:\n'
    '- Be concise. 1-3 sentences for voice delivery unless asked to elaborate.\n'
    '- Never say "certainly", "of course", "absolutely", "great question". Sound like a person.\n'
    '- Answer directly from the context provided. Only say you need to look something up if it truly is not in context.\n'
    '- When the question is simple, answer directly without preamble.'
)


def _build_prompt(user_message: str, context: dict) -> str:
    now = datetime.now()
    date_str = now.strftime("%A, %d %B %Y")
    time_str = now.strftime("%I:%M %p")

    city = context.get("city", "Delhi")
    weather_str = context.get("weather_summary", "weather unavailable")
    pending_reminders = context.get("pending_reminders", [])
    reminders_str = json.dumps(pending_reminders) if pending_reminders else "none"

    context_block = (
        f"[CURRENT CONTEXT]\n"
        f"Date: {date_str} | Time: {time_str}\n"
        f"Location: {city}\n"
        f"Weather: {weather_str}\n"
        f"Pending reminders: {reminders_str}\n\n"
        f"[USER MESSAGE]\n{user_message}"
    )
    return context_block


async def process(user_message: str, context: dict) -> str:
    prompt = _build_prompt(user_message, context)
    response_parts = []

    async for msg in query(
        prompt=prompt,
        options=ClaudeCodeOptions(
            model=MODEL,
            system_prompt=SYSTEM_PROMPT,
            max_turns=1,
            allowed_tools=[],
        )
    ):
        if isinstance(msg, AssistantMessage):
            for block in msg.content:
                if isinstance(block, TextBlock):
                    response_parts.append(block.text)
        elif isinstance(msg, ResultMessage) and msg.is_error:
            print(f"[Brain] SDK error: {msg}")

    result = " ".join(response_parts).strip()
    if not result:
        return "I ran into an issue processing that, boss."
    print(f"[Brain] Response: {result[:80]}...")
    return result


async def build_morning_brief(context: dict) -> str:
    city = context.get("city", "Delhi")
    weather = context.get("weather_summary", "")
    reminders = context.get("pending_reminders", [])
    reminder_text = f" You also have {len(reminders)} pending reminder(s)." if reminders else ""
    prompt = (
        f"Give a morning briefing for Sanidhya. It's {datetime.now().strftime('%A %d %B')}. "
        f"He's in {city}. Weather: {weather}.{reminder_text} Keep it under 3 sentences, JARVIS style."
    )
    return await process(prompt, context)
