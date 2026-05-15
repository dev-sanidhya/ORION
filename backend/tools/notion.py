"""Notion API - daily logs + ideas database.

Setup:
  1. notion.so/my-integrations -> create integration -> copy "Internal Integration Secret"
  2. Set NOTION_TOKEN in backend/.env
  3. Create two Notion databases:
        - "Daily Log"  (with title column "Date")
        - "Ideas"      (with title column "Title" + optional rich-text column "Note")
  4. Share each database with the integration (... -> Connections -> add integration)
  5. Copy each database ID from its URL and set:
        NOTION_DAILY_DB_ID  =  <id from URL>
        NOTION_IDEAS_DB_ID  =  <id from URL>
"""
import os
import httpx
from datetime import datetime
from typing import Optional

API_BASE = "https://api.notion.com/v1"
NOTION_VERSION = "2022-06-28"


def _headers() -> Optional[dict]:
    token = os.getenv("NOTION_TOKEN", "").strip()
    if not token:
        return None
    return {
        "Authorization": f"Bearer {token}",
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
    }


def is_configured() -> bool:
    return _headers() is not None


async def append_daily_log(summary: str, commits: list[str], tweets: list[str]) -> dict:
    """Create a new page in the daily log database for today."""
    db_id = os.getenv("NOTION_DAILY_DB_ID", "").strip()
    headers = _headers()
    if not headers or not db_id:
        return {"ok": False, "error": "Notion daily log not configured"}

    today = datetime.now().strftime("%Y-%m-%d")
    children = [
        {"object": "block", "type": "heading_2",
         "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Summary"}}]}},
        {"object": "block", "type": "paragraph",
         "paragraph": {"rich_text": [{"type": "text", "text": {"content": summary}}]}},
    ]
    if commits:
        children.append({"object": "block", "type": "heading_2",
                         "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Commits"}}]}})
        for c in commits[:20]:
            children.append({"object": "block", "type": "bulleted_list_item",
                             "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": c}}]}})
    if tweets:
        children.append({"object": "block", "type": "heading_2",
                         "heading_2": {"rich_text": [{"type": "text", "text": {"content": "Tweets posted"}}]}})
        for t in tweets[:10]:
            children.append({"object": "block", "type": "bulleted_list_item",
                             "bulleted_list_item": {"rich_text": [{"type": "text", "text": {"content": t}}]}})

    payload = {
        "parent": {"database_id": db_id},
        "properties": {
            "Date": {"title": [{"text": {"content": today}}]},
        },
        "children": children,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(f"{API_BASE}/pages", headers=headers, json=payload)
            r.raise_for_status()
            return {"ok": True, "page_id": r.json().get("id")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def append_idea(title: str, note: str = "") -> dict:
    """Append a new idea row. Falls back to title-only if Note column doesn't exist."""
    db_id = os.getenv("NOTION_IDEAS_DB_ID", "").strip()
    headers = _headers()
    if not headers or not db_id:
        return {"ok": False, "error": "Notion ideas DB not configured"}

    props = {"Title": {"title": [{"text": {"content": title}}]}}
    if note:
        props["Note"] = {"rich_text": [{"text": {"content": note}}]}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(
                f"{API_BASE}/pages",
                headers=headers,
                json={"parent": {"database_id": db_id}, "properties": props},
            )
            if r.status_code == 400 and note:
                # Retry without the Note column (schema may differ)
                r = await client.post(
                    f"{API_BASE}/pages",
                    headers=headers,
                    json={"parent": {"database_id": db_id},
                          "properties": {"Title": props["Title"]}},
                )
            r.raise_for_status()
            return {"ok": True}
    except Exception as e:
        return {"ok": False, "error": str(e)}
