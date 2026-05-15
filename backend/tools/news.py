import feedparser
import httpx
from datetime import datetime

FEEDS = {
    "top": "https://feeds.bbci.co.uk/news/rss.xml",
    "tech": "https://feeds.bbci.co.uk/news/technology/rss.xml",
    "india": "https://feeds.bbci.co.uk/news/world/asia/india/rss.xml",
    "hacker_news": "https://hnrss.org/frontpage",
}


async def get_news(category: str = "top", limit: int = 5) -> list[dict]:
    feed_url = FEEDS.get(category, FEEDS["top"])
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            r = await client.get(feed_url)
            r.raise_for_status()
            feed = feedparser.parse(r.text)

        items = []
        for entry in feed.entries[:limit]:
            items.append({
                "title": entry.get("title", ""),
                "summary": entry.get("summary", "")[:200],
                "link": entry.get("link", ""),
                "published": entry.get("published", ""),
            })
        return items
    except Exception as e:
        return [{"title": f"Could not fetch {category} news", "summary": str(e), "link": "", "published": ""}]


async def get_news_summary(category: str = "top", limit: int = 3) -> str:
    items = await get_news(category, limit)
    if not items:
        return "No news available right now."
    lines = [f"{i+1}. {item['title']}" for i, item in enumerate(items)]
    return "\n".join(lines)
