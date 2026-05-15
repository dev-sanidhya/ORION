"""Google Calendar via private ICS URL.

Setup (no OAuth):
  calendar.google.com -> Settings -> click your calendar -> scroll to
  'Integrate calendar' -> 'Secret address in iCal format' -> copy URL
  Set GCAL_ICS_URL in backend/.env. Multiple calendars: comma-separate URLs.
"""
import os
import re
import httpx
from datetime import datetime, timedelta, timezone
from typing import Optional

_ICS_CACHE: dict = {"at": None, "data": []}
_CACHE_TTL = timedelta(minutes=10)


def is_configured() -> bool:
    return bool(os.getenv("GCAL_ICS_URL", "").strip())


def _parse_dt(s: str) -> Optional[datetime]:
    """Parse ICS DTSTART/DTEND value into a tz-aware datetime."""
    s = s.strip()
    try:
        if s.endswith("Z"):
            return datetime.strptime(s, "%Y%m%dT%H%M%SZ").replace(tzinfo=timezone.utc)
        if "T" in s:
            return datetime.strptime(s, "%Y%m%dT%H%M%S").replace(tzinfo=timezone.utc)
        # all-day
        return datetime.strptime(s, "%Y%m%d").replace(tzinfo=timezone.utc)
    except Exception:
        return None


def _parse_ics(text: str) -> list[dict]:
    """Minimal ICS VEVENT parser - good enough for upcoming-events display."""
    events = []
    current: Optional[dict] = None
    for raw in text.splitlines():
        line = raw.rstrip("\r")
        if line == "BEGIN:VEVENT":
            current = {}
        elif line == "END:VEVENT":
            if current and "start" in current:
                events.append(current)
            current = None
        elif current is not None:
            # Properties may have params: "DTSTART;TZID=Asia/Kolkata:20260515T100000"
            key_part, _, value = line.partition(":")
            key = key_part.split(";", 1)[0]
            if key == "SUMMARY":
                current["title"] = value
            elif key == "DTSTART":
                current["start"] = _parse_dt(value)
            elif key == "DTEND":
                current["end"] = _parse_dt(value)
            elif key == "LOCATION":
                current["location"] = value
    return events


async def _fetch_all() -> list[dict]:
    urls = os.getenv("GCAL_ICS_URL", "").strip()
    if not urls:
        return []

    now = datetime.now(timezone.utc)
    if _ICS_CACHE["at"] and now - _ICS_CACHE["at"] < _CACHE_TTL:
        return _ICS_CACHE["data"]

    all_events: list[dict] = []
    async with httpx.AsyncClient(timeout=10, follow_redirects=True) as client:
        for url in [u.strip() for u in urls.split(",") if u.strip()]:
            try:
                r = await client.get(url)
                r.raise_for_status()
                all_events.extend(_parse_ics(r.text))
            except Exception as e:
                print(f"[Calendar] fetch error: {e}")

    _ICS_CACHE["at"] = now
    _ICS_CACHE["data"] = all_events
    return all_events


async def upcoming_events(limit: int = 5, hours_ahead: int = 24) -> list[dict]:
    """Return next N events within the window."""
    events = await _fetch_all()
    now = datetime.now(timezone.utc)
    cutoff = now + timedelta(hours=hours_ahead)

    upcoming = [
        e for e in events
        if e.get("start") and now - timedelta(minutes=15) <= e["start"] <= cutoff
    ]
    upcoming.sort(key=lambda e: e["start"])

    return [
        {
            "title": e.get("title", "Untitled"),
            "start_iso": e["start"].isoformat(),
            "location": e.get("location", ""),
        }
        for e in upcoming[:limit]
    ]
