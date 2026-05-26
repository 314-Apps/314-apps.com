import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Optional
from cachetools import TTLCache
import logging
import asyncio
from concurrent.futures import ThreadPoolExecutor

from config.settings import settings

logger = logging.getLogger(__name__)
_executor = ThreadPoolExecutor(max_workers=8)
_quote_cache = TTLCache(maxsize=200, ttl=settings.quote_refresh_interval)
_history_cache = TTLCache(maxsize=200, ttl=3600)


def _fetch_quote_sync(symbol: str) -> dict:
    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        hist = ticker.history(period="2d")
        if hist.empty:
            return {}

        last_row = hist.iloc[-1]
        prev_close = hist.iloc[-2]["Close"] if len(hist) > 1 else last_row["Close"]
        price = last_row["Close"]
        change_pct = ((price - prev_close) / prev_close * 100) if prev_close else 0

        return {
            "symbol": symbol,
            "price": round(float(price), 2),
            "open_price": round(float(last_row.get("Open", 0)), 2),
            "high": round(float(last_row.get("High", 0)), 2),
            "low": round(float(last_row.get("Low", 0)), 2),
            "volume": int(last_row.get("Volume", 0)),
            "prev_close": round(float(prev_close), 2),
            "change_pct": round(float(change_pct), 2),
            "market_cap": getattr(info, "market_cap", None),
            "timestamp": datetime.now(),
        }
    except Exception as e:
        logger.error(f"Error fetching quote for {symbol}: {e}")
        return {}


def _fetch_history_sync(symbol: str, period: str = "3mo", interval: str = "1d") -> pd.DataFrame:
    try:
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)
        return hist
    except Exception as e:
        logger.error(f"Error fetching history for {symbol}: {e}")
        return pd.DataFrame()


async def get_quote(symbol: str) -> dict:
    cache_key = f"quote_{symbol}"
    if cache_key in _quote_cache:
        return _quote_cache[cache_key]

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _fetch_quote_sync, symbol)
    if result:
        _quote_cache[cache_key] = result
    return result


async def get_quotes(symbols: list[str]) -> list[dict]:
    tasks = [get_quote(s) for s in symbols]
    results = await asyncio.gather(*tasks, return_exceptions=True)
    return [r for r in results if isinstance(r, dict) and r]


async def get_history(symbol: str, period: str = "3mo", interval: str = "1d") -> pd.DataFrame:
    cache_key = f"hist_{symbol}_{period}_{interval}"
    if cache_key in _history_cache:
        return _history_cache[cache_key]

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(_executor, _fetch_history_sync, symbol, period, interval)
    if not result.empty:
        _history_cache[cache_key] = result
    return result


async def get_multiple_histories(symbols: list[str], period: str = "3mo") -> dict[str, pd.DataFrame]:
    tasks = {s: get_history(s, period) for s in symbols}
    results = {}
    for symbol, task in tasks.items():
        try:
            results[symbol] = await task
        except Exception as e:
            logger.error(f"Error fetching history for {symbol}: {e}")
    return results


def get_sector_performance() -> dict:
    sector_etfs = {
        "Technology": "XLK",
        "Healthcare": "XLV",
        "Financials": "XLF",
        "Energy": "XLE",
        "Consumer Discretionary": "XLY",
        "Consumer Staples": "XLP",
        "Industrials": "XLI",
        "Materials": "XLB",
        "Utilities": "XLU",
        "Real Estate": "XLRE",
        "Communications": "XLC",
    }
    results = {}
    for name, etf in sector_etfs.items():
        try:
            data = _fetch_quote_sync(etf)
            if data:
                results[name] = data.get("change_pct", 0)
        except Exception:
            pass
    return results
