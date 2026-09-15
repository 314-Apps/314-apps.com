import feedparser
import httpx
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from typing import Optional
import asyncio
import logging
import re
from cachetools import TTLCache

from config.settings import settings

logger = logging.getLogger(__name__)
_news_cache = TTLCache(maxsize=500, ttl=settings.news_refresh_interval)

RSS_FEEDS = {
    "Yahoo Finance": "https://finance.yahoo.com/news/rssindex",
    "MarketWatch": "http://feeds.marketwatch.com/marketwatch/topstories/",
    "CNBC": "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=100003114",
    "Reuters Business": "https://news.google.com/rss/topics/CAAqJggKIiBDQkFTRWdvSUwyMHZNRGx6TVdZU0FtVnVHZ0pWVXlnQVAB",
    "Investing.com": "https://www.investing.com/rss/news.rss",
    "Seeking Alpha": "https://seekingalpha.com/market_currents.xml",
}

STOCK_KEYWORDS = {
    "AAPL": ["apple", "iphone", "ipad", "mac", "tim cook"],
    "MSFT": ["microsoft", "azure", "windows", "satya nadella", "teams"],
    "GOOGL": ["google", "alphabet", "youtube", "sundar pichai", "waymo"],
    "AMZN": ["amazon", "aws", "bezos", "jassy", "prime"],
    "META": ["meta", "facebook", "instagram", "whatsapp", "zuckerberg"],
    "NVDA": ["nvidia", "gpu", "jensen huang", "cuda", "geforce"],
    "TSLA": ["tesla", "elon musk", "electric vehicle", "ev", "autopilot"],
    "JPM": ["jpmorgan", "jp morgan", "jamie dimon", "chase"],
    "BAC": ["bank of america", "bofa"],
    "WFC": ["wells fargo"],
    "GS": ["goldman sachs", "goldman"],
    "MS": ["morgan stanley"],
    "JNJ": ["johnson & johnson", "johnson and johnson"],
    "UNH": ["unitedhealth", "united health"],
    "PFE": ["pfizer"],
    "MRK": ["merck"],
    "ABBV": ["abbvie"],
    "XOM": ["exxon", "exxonmobil"],
    "CVX": ["chevron"],
    "COP": ["conocophillips"],
    "HD": ["home depot"],
    "WMT": ["walmart"],
    "COST": ["costco"],
    "TGT": ["target corp"],
    "DIS": ["disney", "walt disney"],
    "NFLX": ["netflix"],
    "CMCSA": ["comcast"],
    "V": ["visa inc"],
    "MA": ["mastercard"],
    "PYPL": ["paypal"],
    "BA": ["boeing"],
    "CAT": ["caterpillar"],
    "GE": ["general electric"],
    "HON": ["honeywell"],
    "CRM": ["salesforce"],
    "ORCL": ["oracle corp"],
    "ADBE": ["adobe"],
    "INTC": ["intel corp", "intel "],
    "AMD": ["advanced micro devices", " amd "],
}

MARKET_TERMS_BULLISH = [
    "surge", "soar", "rally", "jump", "gain", "rise", "climb", "upbeat",
    "bullish", "outperform", "upgrade", "beat", "record high", "breakout",
    "strong earnings", "revenue beat", "guidance raised", "buyback",
    "dividend increase", "expansion", "growth", "acquisition",
]

MARKET_TERMS_BEARISH = [
    "plunge", "crash", "drop", "fall", "decline", "slide", "tumble",
    "bearish", "underperform", "downgrade", "miss", "record low",
    "breakdown", "weak earnings", "revenue miss", "guidance cut",
    "layoff", "lawsuit", "investigation", "recall", "default", "bankruptcy",
]


def _extract_symbols(text: str) -> list[str]:
    text_lower = text.lower()
    found = set()

    # Direct ticker mention: $AAPL or (AAPL)
    ticker_matches = re.findall(r'[\$\(]([A-Z]{1,5})[\)\s,.]', text)
    for match in ticker_matches:
        if match in STOCK_KEYWORDS:
            found.add(match)

    for symbol, keywords in STOCK_KEYWORDS.items():
        for kw in keywords:
            if kw in text_lower:
                found.add(symbol)
                break

    return list(found)


def _parse_feed_date(entry) -> Optional[datetime]:
    for attr in ["published_parsed", "updated_parsed"]:
        parsed = getattr(entry, attr, None)
        if parsed:
            try:
                from time import mktime
                return datetime.fromtimestamp(mktime(parsed))
            except Exception:
                pass
    return datetime.now()


async def fetch_rss_news() -> list[dict]:
    articles = []
    cutoff = datetime.now() - timedelta(hours=settings.news_lookback_hours)

    for source_name, url in RSS_FEEDS.items():
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url, headers={
                    "User-Agent": "Mozilla/5.0 (compatible; StockAdvisor/1.0)"
                })
                if resp.status_code != 200:
                    continue

            feed = feedparser.parse(resp.text)

            for entry in feed.entries[:20]:
                published = _parse_feed_date(entry)
                if published and published < cutoff:
                    continue

                title = getattr(entry, "title", "")
                summary = getattr(entry, "summary", "")
                if summary:
                    summary = BeautifulSoup(summary, "lxml").get_text()[:500]

                link = getattr(entry, "link", "")
                full_text = f"{title} {summary}"
                symbols = _extract_symbols(full_text)

                articles.append({
                    "title": title,
                    "source": source_name,
                    "url": link,
                    "summary": summary,
                    "symbols": symbols,
                    "published_at": published,
                })
        except Exception as e:
            logger.warning(f"Failed to fetch {source_name}: {e}")
            continue

    return articles


async def fetch_stock_news(symbol: str) -> list[dict]:
    """Fetch news specific to a stock using Yahoo Finance RSS."""
    articles = []
    try:
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={symbol}&region=US&lang=en-US"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers={
                "User-Agent": "Mozilla/5.0 (compatible; StockAdvisor/1.0)"
            })
            if resp.status_code == 200:
                feed = feedparser.parse(resp.text)
                for entry in feed.entries[:10]:
                    published = _parse_feed_date(entry)
                    title = getattr(entry, "title", "")
                    summary = getattr(entry, "summary", "")
                    if summary:
                        summary = BeautifulSoup(summary, "lxml").get_text()[:500]

                    articles.append({
                        "title": title,
                        "source": "Yahoo Finance",
                        "url": getattr(entry, "link", ""),
                        "summary": summary,
                        "symbols": [symbol],
                        "published_at": published,
                    })
    except Exception as e:
        logger.warning(f"Failed to fetch news for {symbol}: {e}")

    return articles


async def get_all_news(symbols: Optional[list[str]] = None) -> list[dict]:
    cache_key = "all_news"
    if cache_key in _news_cache:
        return _news_cache[cache_key]

    all_articles = await fetch_rss_news()

    if symbols:
        for symbol in symbols[:10]:
            stock_articles = await fetch_stock_news(symbol)
            all_articles.extend(stock_articles)

    seen_titles = set()
    unique = []
    for article in all_articles:
        title_key = article["title"].lower().strip()[:60]
        if title_key not in seen_titles:
            seen_titles.add(title_key)
            unique.append(article)

    unique.sort(key=lambda x: x.get("published_at") or datetime.min, reverse=True)

    _news_cache[cache_key] = unique
    return unique
