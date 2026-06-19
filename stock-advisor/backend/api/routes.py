from fastapi import APIRouter, HTTPException, Query
from datetime import datetime
from typing import Optional
import logging

from config.settings import settings
from backend.services.market_data import get_quote, get_quotes
from backend.services.news_service import get_all_news
from backend.services.sentiment_analyzer import analyze_news_batch, get_aggregate_sentiment
from backend.analysis.signal_generator import generate_signal, scan_watchlist
from backend.analysis.technical import compute_indicators, compute_support_resistance, compute_trend
from backend.services.market_data import get_history
from backend.services.portfolio_manager import (
    get_portfolio, set_portfolio_value, execute_trade,
    update_position_prices, check_stop_loss_take_profit,
    generate_recommendations,
)
from backend.models.pydantic_models import (
    ExecuteTradeRequest, ClosePositionRequest, WatchlistUpdate, PortfolioUpdate,
)

logger = logging.getLogger(__name__)
router = APIRouter()

_custom_watchlist = None


@router.get("/health")
async def health():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@router.get("/dashboard")
async def dashboard():
    """Main dashboard endpoint - returns everything the UI needs."""
    try:
        watchlist = _custom_watchlist or settings.default_watchlist

        quotes = await get_quotes(watchlist[:20])
        update_position_prices(quotes)

        portfolio = get_portfolio()
        alerts = check_stop_loss_take_profit(quotes)

        news = await get_all_news(watchlist[:5])
        news = analyze_news_batch(news)

        return {
            "portfolio": portfolio,
            "watchlist_quotes": quotes,
            "recent_news": news[:30],
            "alerts": alerts,
            "last_updated": datetime.now().isoformat(),
        }
    except Exception as e:
        logger.error(f"Dashboard error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/quotes/{symbol}")
async def get_stock_quote(symbol: str):
    quote = await get_quote(symbol.upper())
    if not quote:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    return quote


@router.get("/quotes")
async def get_stock_quotes(symbols: Optional[str] = None):
    if symbols:
        symbol_list = [s.strip().upper() for s in symbols.split(",")]
    else:
        symbol_list = _custom_watchlist or settings.default_watchlist
    return await get_quotes(symbol_list[:30])


@router.get("/news")
async def get_news(symbol: Optional[str] = None, limit: int = 30):
    symbols = [symbol.upper()] if symbol else (_custom_watchlist or settings.default_watchlist)[:5]
    articles = await get_all_news(symbols)
    articles = analyze_news_batch(articles)
    if symbol:
        articles = [a for a in articles if symbol.upper() in a.get("symbols", [])]
    return articles[:limit]


@router.get("/analysis/{symbol}")
async def get_analysis(symbol: str):
    """Full analysis for a single stock."""
    symbol = symbol.upper()
    try:
        signal = await generate_signal(symbol)
        hist = await get_history(symbol, period="6mo")
        technicals = compute_indicators(hist)
        sr_levels = compute_support_resistance(hist)
        trend = compute_trend(hist)

        news = await get_all_news([symbol])
        news = analyze_news_batch(news)
        sentiment = get_aggregate_sentiment(news, symbol)

        return {
            "symbol": symbol,
            "signal": signal,
            "technicals": technicals,
            "support_resistance": sr_levels,
            "trend": trend,
            "sentiment": sentiment,
            "relevant_news": [n for n in news if symbol in n.get("symbols", [])][:10],
        }
    except Exception as e:
        logger.error(f"Analysis error for {symbol}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/signals")
async def get_signals(symbols: Optional[str] = None):
    """Get trading signals for watchlist."""
    if symbols:
        symbol_list = [s.strip().upper() for s in symbols.split(",")]
    else:
        symbol_list = _custom_watchlist or settings.default_watchlist

    result = await scan_watchlist(symbol_list)
    return result


@router.get("/signals/{symbol}")
async def get_signal(symbol: str):
    signal = await generate_signal(symbol.upper())
    return signal


@router.get("/recommendations")
async def get_recommendations():
    """Get actionable trade recommendations."""
    watchlist = _custom_watchlist or settings.default_watchlist
    result = await scan_watchlist(watchlist)
    recs = generate_recommendations(result["actionable"])
    return {
        "recommendations": recs,
        "buy_count": len([r for r in recs if r["direction"] == "BUY"]),
        "sell_count": len([r for r in recs if r["direction"] == "SELL"]),
        "generated_at": datetime.now().isoformat(),
    }


@router.get("/portfolio")
async def portfolio():
    return get_portfolio()


@router.post("/portfolio/update")
async def update_portfolio(data: PortfolioUpdate):
    set_portfolio_value(data.total_value, data.cash)
    return get_portfolio()


@router.post("/trade/execute")
async def trade_execute(data: ExecuteTradeRequest):
    """Record a manually executed trade."""
    result = execute_trade(
        symbol=data.recommendation_id,  # Will be overridden
        direction="BUY",
        shares=data.shares or 0,
        price=data.executed_price,
        notes=data.notes or "",
    )
    return result


@router.post("/trade/buy")
async def trade_buy(symbol: str, shares: int, price: float, notes: str = ""):
    result = execute_trade(symbol.upper(), "BUY", shares, price, notes)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.post("/trade/sell")
async def trade_sell(symbol: str, shares: int, price: float, notes: str = ""):
    result = execute_trade(symbol.upper(), "SELL", shares, price, notes)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@router.get("/portfolio/alerts")
async def portfolio_alerts():
    watchlist = _custom_watchlist or settings.default_watchlist
    position_symbols = list(get_portfolio()["positions"])
    if not position_symbols:
        return {"alerts": []}

    symbols = [p["symbol"] if isinstance(p, dict) else p for p in position_symbols]
    quotes = await get_quotes(symbols)
    alerts = check_stop_loss_take_profit(quotes)
    return {"alerts": alerts}


@router.post("/watchlist")
async def update_watchlist(data: WatchlistUpdate):
    global _custom_watchlist
    _custom_watchlist = [s.upper() for s in data.symbols]
    return {"watchlist": _custom_watchlist}


@router.get("/watchlist")
async def get_watchlist():
    return {"watchlist": _custom_watchlist or settings.default_watchlist}


@router.get("/technicals/{symbol}")
async def get_technicals(symbol: str):
    hist = await get_history(symbol.upper(), period="6mo")
    technicals = compute_indicators(hist)
    sr_levels = compute_support_resistance(hist)
    trend = compute_trend(hist)
    return {
        "symbol": symbol.upper(),
        "indicators": technicals,
        "support_resistance": sr_levels,
        "trend": trend,
    }
