import httpx
import os

_cached_location: dict | None = None


async def get_location() -> dict:
    global _cached_location

    # Manual override via env - always wins
    override_city = os.getenv("ORION_CITY")
    if override_city:
        return {
            "city": override_city,
            "region": os.getenv("ORION_REGION", ""),
            "country": os.getenv("ORION_COUNTRY", "India"),
            "latitude": float(os.getenv("ORION_LAT", "27.8974")),
            "longitude": float(os.getenv("ORION_LON", "78.0880")),
            "timezone": os.getenv("ORION_TIMEZONE", "Asia/Kolkata"),
        }

    if _cached_location:
        return _cached_location

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get("https://ipapi.co/json/")
            r.raise_for_status()
            data = r.json()
            _cached_location = {
                "city": data.get("city", "Unknown"),
                "region": data.get("region", ""),
                "country": data.get("country_name", ""),
                "latitude": data.get("latitude", 0),
                "longitude": data.get("longitude", 0),
                "timezone": data.get("timezone", "Asia/Kolkata"),
            }
            return _cached_location
    except Exception:
        return {
            "city": "New Delhi",
            "region": "Delhi",
            "country": "India",
            "latitude": 28.6139,
            "longitude": 77.2090,
            "timezone": "Asia/Kolkata",
        }


def invalidate_location_cache():
    global _cached_location
    _cached_location = None
