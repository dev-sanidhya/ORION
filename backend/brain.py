import asyncio
import os
import json
from datetime import datetime
import httpx
from tools.weather import get_weather
from tools.location import get_location
from tools.memory import (
    get_recent_conversations, write_fact, get_all_facts,
    add_reminder, get_pending_reminders
)
from tools.news import get_news_summary
from tools.git_tools import get_recent_commits

API_URL = "https://api.anthropic.com/v1/messages"
MODEL = os.getenv("ORION_MODEL", "claude-sonnet-4-6")

_token: str | None = None
_http: httpx.AsyncClient | None = None


def get_http() -> httpx.AsyncClient:
    global _token, _http
    if _http is None:
        _token = os.environ.get("CLAUDE_CODE_OAUTH_TOKEN", "").strip()
        if not _token:
            raise RuntimeError("CLAUDE_CODE_OAUTH_TOKEN not set. Run: claude setup-token")
        _http = httpx.AsyncClient(
            headers={
                "Authorization": f"Bearer {_token}",
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            timeout=60.0,
        )
        print("[Brain] HTTP client initialized via OAuth Bearer")
    return _http


TOOLS = [
    {
        "name": "get_weather",
        "description": "Get current weather and forecast for a city.",
        "input_schema": {
            "type": "object",
            "properties": {
                "city": {"type": "string", "description": "City name, e.g. 'Delhi'"}
            },
            "required": ["city"],
        },
    },
    {
        "name": "get_location",
        "description": "Get Sanidhya's current location based on IP address.",
        "input_schema": {"type": "object", "properties": {}},
    },
    {
        "name": "read_memory",
        "description": "Read recent conversation history or stored personal facts.",
        "input_schema": {
            "type": "object",
            "properties": {
                "type": {
                    "type": "string",
                    "enum": ["conversations", "facts", "reminders"],
                    "description": "What to read",
                }
            },
            "required": ["type"],
        },
    },
    {
        "name": "write_fact",
        "description": "Store a personal fact or preference for future reference.",
        "input_schema": {
            "type": "object",
            "properties": {
                "key": {"type": "string", "description": "Short identifier, e.g. 'home_city'"},
                "value": {"type": "string", "description": "The value to store"},
            },
            "required": ["key", "value"],
        },
    },
    {
        "name": "add_reminder",
        "description": "Set a reminder for Sanidhya.",
        "input_schema": {
            "type": "object",
            "properties": {
                "content": {"type": "string", "description": "Reminder text"},
                "remind_at": {"type": "string", "description": "ISO datetime or natural time like '18:00'"},
            },
            "required": ["content"],
        },
    },
    {
        "name": "get_news",
        "description": "Get latest news headlines by category.",
        "input_schema": {
            "type": "object",
            "properties": {
                "category": {
                    "type": "string",
                    "enum": ["top", "tech", "india", "hacker_news"],
                    "description": "News category",
                },
                "limit": {"type": "integer", "description": "Number of headlines (default 3)"},
            },
        },
    },
    {
        "name": "get_git_log",
        "description": "Get recent git commits for a project to see what was shipped.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project": {"type": "string", "description": "Project name or full path. Leave empty for ORION."},
                "n": {"type": "integer", "description": "Number of commits to fetch (default 5)"},
            },
        },
    },
]


async def _execute_tool(name: str, tool_input: dict) -> str:
    try:
        if name == "get_weather":
            result = await get_weather(tool_input["city"])
            return json.dumps(result)

        elif name == "get_location":
            result = await get_location()
            return json.dumps(result)

        elif name == "read_memory":
            t = tool_input.get("type", "conversations")
            if t == "conversations":
                convs = await get_recent_conversations(8)
                return json.dumps(convs)
            elif t == "facts":
                facts = await get_all_facts()
                return json.dumps(facts)
            elif t == "reminders":
                reminders = await get_pending_reminders()
                return json.dumps(reminders)

        elif name == "write_fact":
            await write_fact(tool_input["key"], tool_input["value"])
            return '{"status": "saved"}'

        elif name == "add_reminder":
            await add_reminder(tool_input["content"], tool_input.get("remind_at"))
            return '{"status": "reminder set"}'

        elif name == "get_news":
            category = tool_input.get("category", "top")
            limit = tool_input.get("limit", 3)
            summary = await get_news_summary(category, limit)
            return json.dumps({"headlines": summary})

        elif name == "get_git_log":
            project = tool_input.get("project", "")
            n = tool_input.get("n", 5)
            if project and not os.path.isabs(project):
                portfolio = os.getenv("PORTFOLIO_DIR", r"C:\Users\shish\Desktop\PORTFOLIO")
                project = os.path.join(portfolio, project)
            commits = get_recent_commits(project or None, n)
            return json.dumps(commits)

    except Exception as e:
        return json.dumps({"error": str(e)})

    return '{"error": "unknown tool"}'


def _build_system_prompt(context: dict) -> list:
    now = datetime.now()
    date_str = now.strftime("%A, %d %B %Y")
    time_str = now.strftime("%I:%M %p")

    city = context.get("city", "Delhi")
    weather_str = context.get("weather_summary", "weather unavailable")
    facts_str = json.dumps(context.get("facts", {}), indent=2) if context.get("facts") else "none"
    pending_reminders = context.get("pending_reminders", [])
    reminders_str = json.dumps(pending_reminders) if pending_reminders else "none"

    static_block = {
        "type": "text",
        "text": (
            'You are ORION, Sanidhya Shishodia\'s personal AI assistant. '
            'You speak like JARVIS from Iron Man - calm, precise, dry wit, slightly formal. '
            'Address him as "boss" or "sir".\n\n'
            'RULES:\n'
            '- Be concise. 1-3 sentences for voice delivery unless asked to elaborate.\n'
            '- Never say "certainly", "of course", "absolutely", "great question". Sound like a person.\n'
            '- You have real-time context loaded in the next block - use it without calling tools unless fresher data is needed.\n'
            '- When the question is simple, answer directly.'
        ),
        "cache_control": {"type": "ephemeral"},
    }

    dynamic_block = {
        "type": "text",
        "text": (
            f"CURRENT CONTEXT:\n"
            f"- Date: {date_str}\n"
            f"- Time: {time_str}\n"
            f"- Location: {city}\n"
            f"- Weather: {weather_str}\n"
            f"- Stored facts: {facts_str}\n"
            f"- Pending reminders: {reminders_str}\n\n"
            "Tools available: weather, location, memory read/write, reminders."
        ),
    }

    return [static_block, dynamic_block]


async def _call_api(messages: list, system: list) -> dict:
    http = get_http()
    body = {
        "model": MODEL,
        "max_tokens": 512,
        "system": system,
        "tools": TOOLS,
        "messages": messages,
    }
    resp = await http.post(API_URL, json=body)
    if resp.status_code != 200:
        raise RuntimeError(f"API error {resp.status_code}: {resp.text[:300]}")
    return resp.json()


async def process(user_message: str, context: dict) -> str:
    system = _build_system_prompt(context)
    messages = [{"role": "user", "content": user_message}]

    while True:
        data = await _call_api(messages, system)
        stop_reason = data.get("stop_reason")
        content = data.get("content", [])

        if stop_reason == "end_turn":
            for block in content:
                if block.get("type") == "text":
                    return block["text"].strip()
            return ""

        if stop_reason == "tool_use":
            tool_results = []
            for block in content:
                if block.get("type") == "tool_use":
                    print(f"[Brain] Tool: {block['name']}({block['input']})")
                    result = await _execute_tool(block["name"], block["input"])
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block["id"],
                        "content": result,
                    })

            messages.append({"role": "assistant", "content": content})
            messages.append({"role": "user", "content": tool_results})
            continue

        break

    return "I ran into an issue processing that, boss."


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
