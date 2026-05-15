import httpx

GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search"
WEATHER_URL = "https://api.open-meteo.com/v1/forecast"

WMO_CODES = {
    0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Icy fog", 51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain", 71: "Light snow", 73: "Snow",
    75: "Heavy snow", 80: "Rain showers", 81: "Heavy showers", 82: "Violent showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with heavy hail",
}


async def get_weather(city: str) -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        geo = await client.get(GEOCODE_URL, params={"name": city, "count": 1, "language": "en"})
        geo.raise_for_status()
        results = geo.json().get("results")
        if not results:
            return {"error": f"City '{city}' not found"}

        lat = results[0]["latitude"]
        lon = results[0]["longitude"]
        name = results[0]["name"]
        country = results[0].get("country", "")

        weather = await client.get(WEATHER_URL, params={
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,apparent_temperature,weathercode,windspeed_10m,relative_humidity_2m",
            "daily": "temperature_2m_max,temperature_2m_min,weathercode",
            "timezone": "auto",
            "forecast_days": 1,
        })
        weather.raise_for_status()
        data = weather.json()

        current = data["current"]
        daily = data["daily"]
        code = current["weathercode"]

        return {
            "city": name,
            "country": country,
            "temperature": round(current["temperature_2m"]),
            "feels_like": round(current["apparent_temperature"]),
            "condition": WMO_CODES.get(code, "Unknown"),
            "humidity": current["relative_humidity_2m"],
            "wind_kmh": round(current["windspeed_10m"]),
            "temp_max": round(daily["temperature_2m_max"][0]),
            "temp_min": round(daily["temperature_2m_min"][0]),
            "summary": f"{name} is {round(current['temperature_2m'])}°C, {WMO_CODES.get(code, 'Unknown')}. High {round(daily['temperature_2m_max'][0])}°, Low {round(daily['temperature_2m_min'][0])}°.",
        }
