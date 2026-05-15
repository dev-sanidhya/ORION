import aiosqlite
import json
from datetime import datetime
from pathlib import Path

DB_PATH = Path(__file__).parent.parent / "db" / "orion.db"


async def init_db():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TEXT NOT NULL,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                session_id TEXT
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS facts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                key TEXT UNIQUE NOT NULL,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        await db.execute("""
            CREATE TABLE IF NOT EXISTS reminders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                content TEXT NOT NULL,
                remind_at TEXT,
                done INTEGER DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        await db.commit()


async def save_conversation(role: str, content: str, session_id: str = "default"):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO conversations (timestamp, role, content, session_id) VALUES (?, ?, ?, ?)",
            (datetime.now().isoformat(), role, content, session_id)
        )
        await db.commit()


async def get_recent_conversations(limit: int = 10) -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT role, content, timestamp FROM conversations ORDER BY id DESC LIMIT ?",
            (limit,)
        ) as cursor:
            rows = await cursor.fetchall()
            return [{"role": r[0], "content": r[1], "timestamp": r[2]} for r in reversed(rows)]


async def write_fact(key: str, value: str):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO facts (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at",
            (key, value, datetime.now().isoformat())
        )
        await db.commit()


async def read_fact(key: str) -> str | None:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT value FROM facts WHERE key = ?", (key,)) as cursor:
            row = await cursor.fetchone()
            return row[0] if row else None


async def get_all_facts() -> dict:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute("SELECT key, value FROM facts") as cursor:
            rows = await cursor.fetchall()
            return {r[0]: r[1] for r in rows}


async def add_reminder(content: str, remind_at: str | None = None):
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO reminders (content, remind_at, created_at) VALUES (?, ?, ?)",
            (content, remind_at, datetime.now().isoformat())
        )
        await db.commit()


async def get_pending_reminders() -> list[dict]:
    async with aiosqlite.connect(DB_PATH) as db:
        async with db.execute(
            "SELECT id, content, remind_at FROM reminders WHERE done = 0 ORDER BY remind_at ASC"
        ) as cursor:
            rows = await cursor.fetchall()
            return [{"id": r[0], "content": r[1], "remind_at": r[2]} for r in rows]
