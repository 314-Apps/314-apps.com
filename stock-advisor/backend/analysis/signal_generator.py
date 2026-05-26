import logging
from datetime import datetime, timedelta
from typing import Optional
import numpy as np

from config.settings import settings
from backend.services.market_data import get_quote, get_history
from backend.services.news_service import get_all_news
from backend.services.sentiment_analyzer import analyze_news_batch, get_aggregate_sentiment
from backend.analysis.technical import compute_indicators, compute_support_resistance, compute_trend

logger = logging.getLogger(__name__)


async def generate_signal(symbol: str, news_articles: Optional[list] = None) -> dict:
    """Generate a comprehensive trading signal for a single stock."""

    quote = await get_quote(symbol)
    if not quote or not quote.get("price"):
        return {"symbol": symbol, "direction": "HOLD", "confidence": 0, "error": "No quote data"}

    current_price = quote["price"]

    # --- Technical Analysis ---
    hist = await get_history(symbol, period="6mo", interval="1d")
    technicals = compute_indicators(hist)
    tech_score = technicals.get("overall_technical_score", 0)
    sr_levels = compute_support_resistance(hist)
    trend = compute_trend(hist)

    # --- News Sentiment ---
    if news_articles is None:
        news_articles = await get_all_news([symbol])
        news_articles = analyze_news_batch(news_articles)

    sentiment = get_aggregate_sentiment(news_articles, symbol)
    news_score = sentiment["score"]

    # --- Fundamental Score (simple momentum + volume-based) ---
    fund_score = 0.0
    if quote.get("change_pct"):
        daily_change = quote["change_pct"] / 100
        if abs(daily_change) > 0.02:
            fund_score = min(1.0, max(-1.0, daily_change * 10))

    if quote.get("volume") and hist is not None and not hist.empty:
        avg_vol = float(hist["Volume"].mean())
        if avg_vol > 0:
            vol_ratio = quote["volume"] / avg_vol
            if vol_ratio > 2.0:
                fund_score += 0.2 * np.sign(tech_score) if tech_score != 0 else 0

    fund_score = max(-1.0, min(1.0, fund_score))

    # --- Combined Score ---
    combined = (
        settings.technical_weight * tech_score +
        settings.sentiment_weight * news_score +
        settings.fundamental_weight * fund_score
    )
    combined = max(-1.0, min(1.0, combined))

    # --- Direction ---
    if combined > 0.15:
        direction = "BUY"
    elif combined < -0.15:
        direction = "SELL"
    else:
        direction = "HOLD"

    # --- Confidence ---
    confidence = abs(combined)
    if sentiment["count"] > 3:
        confidence = min(1.0, confidence * 1.1)
    if technicals.get("adx") and technicals["adx"] > 25:
        confidence = min(1.0, confidence * 1.1)
    confidence = round(min(1.0, confidence), 4)

    # --- Strength ---
    if confidence >= 0.7:
        strength = "STRONG"
    elif confidence >= 0.4:
        strength = "MODERATE"
    else:
        strength = "WEAK"

    # --- Price Targets ---
    atr = technicals.get("atr", current_price * 0.02)
    if atr is None:
        atr = current_price * 0.02

    if direction == "BUY":
        stop_loss = round(current_price * (1 - settings.stop_loss_pct), 2)
        target = round(current_price * (1 + settings.take_profit_pct), 2)

        if sr_levels["resistance"]:
            nearest_resistance = sr_levels["resistance"][0]
            target = min(target, round(nearest_resistance * 0.99, 2))
    elif direction == "SELL":
        stop_loss = round(current_price * (1 + settings.stop_loss_pct), 2)
        target = round(current_price * (1 - settings.take_profit_pct), 2)

        if sr_levels["support"]:
            nearest_support = sr_levels["support"][0]
            target = max(target, round(nearest_support * 1.01, 2))
    else:
        stop_loss = None
        target = None

    # --- Position Sizing ---
    risk_per_share = abs(current_price - stop_loss) if stop_loss else current_price * 0.05
    risk_budget = settings.default_portfolio_value * 0.02
    ideal_shares = int(risk_budget / risk_per_share) if risk_per_share > 0 else 0
    max_shares = int(settings.default_portfolio_value * settings.max_position_pct / current_price)
    shares = min(ideal_shares, max_shares)
    position_pct = round((shares * current_price / settings.default_portfolio_value) * 100, 2)

    # --- Rationale ---
    reasons = []
    if tech_score > 0.2:
        reasons.append(f"Technical indicators are bullish (score: {tech_score:.2f})")
    elif tech_score < -0.2:
        reasons.append(f"Technical indicators are bearish (score: {tech_score:.2f})")

    if technicals.get("rsi"):
        rsi = technicals["rsi"]
        if rsi < 30:
            reasons.append(f"RSI at {rsi:.0f} indicates oversold conditions")
        elif rsi > 70:
            reasons.append(f"RSI at {rsi:.0f} indicates overbought conditions")

    if technicals.get("macd_signal") in ("BULLISH_CROSS", "BEARISH_CROSS"):
        reasons.append(f"MACD shows {technicals['macd_signal'].replace('_', ' ').lower()}")

    if news_score > 0.2:
        reasons.append(f"News sentiment is positive ({sentiment['count']} articles, score: {news_score:.2f})")
    elif news_score < -0.2:
        reasons.append(f"News sentiment is negative ({sentiment['count']} articles, score: {news_score:.2f})")

    if trend["direction"] in ("STRONG_UP", "UP"):
        reasons.append(f"Stock is in an uptrend ({trend['recent_return_pct']:.1f}% over 20 days)")
    elif trend["direction"] in ("STRONG_DOWN", "DOWN"):
        reasons.append(f"Stock is in a downtrend ({trend['recent_return_pct']:.1f}% over 20 days)")

    rationale = " | ".join(reasons) if reasons else "Insufficient signal strength for a strong recommendation."

    return {
        "symbol": symbol,
        "direction": direction,
        "strength": strength,
        "confidence": confidence,
        "entry_price": current_price,
        "target_price": target,
        "stop_loss_price": stop_loss,
        "position_size_pct": position_pct,
        "suggested_shares": shares,
        "rationale": rationale,
        "news_sentiment": news_score,
        "technical_score": tech_score,
        "fundamental_score": fund_score,
        "combined_score": round(combined, 4),
        "technicals": technicals,
        "trend": trend,
        "support_resistance": sr_levels,
        "is_active": True,
        "created_at": datetime.now(),
        "expires_at": datetime.now() + timedelta(hours=24),
    }


async def scan_watchlist(symbols: Optional[list[str]] = None) -> list[dict]:
    """Scan the entire watchlist and generate signals."""
    if symbols is None:
        symbols = settings.default_watchlist

    logger.info(f"Scanning {len(symbols)} symbols...")

    news = await get_all_news(symbols[:10])
    news = analyze_news_batch(news)

    signals = []
    for symbol in symbols:
        try:
            signal = await generate_signal(symbol, news_articles=news)
            signals.append(signal)
        except Exception as e:
            logger.error(f"Error generating signal for {symbol}: {e}")

    signals.sort(key=lambda x: x.get("confidence", 0), reverse=True)

    actionable = [
        s for s in signals
        if s["direction"] != "HOLD" and s["confidence"] >= settings.min_signal_confidence
    ]

    return {
        "all_signals": signals,
        "actionable": actionable,
        "buy_signals": [s for s in actionable if s["direction"] == "BUY"],
        "sell_signals": [s for s in actionable if s["direction"] == "SELL"],
        "scanned_at": datetime.now(),
        "total_scanned": len(symbols),
    }
