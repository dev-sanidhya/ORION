"""Typefully API - tweet drafting and analytics.

Requires TYPEFULLY_API_KEY in env. Silently no-ops if not set.
Docs: https://support.typefully.com/en/articles/8718287-typefully-api
"""
import os
import httpx
from typing import Optional

API_BASE = "https://api.typefully.com/v1"


def _headers() -> Optional[dict]:
    key = os.getenv("TYPEFULLY_API_KEY", "").strip()
    if not key:
        return None
    return {"X-API-KEY": key, "Content-Type": "application/json"}


async def is_configured() -> bool:
    return _headers() is not None


async def create_draft(text: str, schedule: str = "next-free-slot") -> dict:
    """Push a draft to Typefully. schedule can be 'next-free-slot' or an ISO timestamp."""
    headers = _headers()
    if not headers:
        return {"ok": False, "error": "TYPEFULLY_API_KEY not set"}

    payload = {"content": text, "schedule-date": schedule}
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(f"{API_BASE}/drafts/", headers=headers, json=payload)
            r.raise_for_status()
            return {"ok": True, "data": r.json()}
    except Exception as e:
        return {"ok": False, "error": str(e)}


async def recently_published(limit: int = 5) -> list[dict]:
    """Returns recently posted tweets with view counts where available."""
    headers = _headers()
    if not headers:
        return []
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{API_BASE}/drafts/recently-published/", headers=headers)
            r.raise_for_status()
            data = r.json()
            items = data if isinstance(data, list) else data.get("drafts", [])
            return items[:limit]
    except Exception as e:
        print(f"[Typefully] recent error: {e}")
        return []
