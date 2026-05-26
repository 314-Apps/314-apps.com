import logging
from datetime import datetime
from typing import Optional
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import settings
from backend.models.schemas import (
    Position, PortfolioState, TradeRecommendation, TradingSignal,
    SignalDirection, TradeStatus,
)

logger = logging.getLogger(__name__)

_portfolio_cache = {
    "total_value": settings.default_portfolio_value,
    "cash": settings.default_portfolio_value,
    "invested": 0.0,
    "realized_pnl": 0.0,
    "positions": {},
    "trade_history": [],
}


def get_portfolio() -> dict:
    positions = _portfolio_cache["positions"]
    invested = sum(
        p["shares"] * p["avg_entry_price"]
        for p in positions.values()
    )
    unrealized = sum(
        p.get("unrealized_pnl", 0)
        for p in positions.values()
    )
    total_trades = len(_portfolio_cache["trade_history"])
    winning = len([t for t in _portfolio_cache["trade_history"] if t.get("pnl", 0) > 0])
    losing = len([t for t in _portfolio_cache["trade_history"] if t.get("pnl", 0) < 0])

    return {
        "total_value": round(_portfolio_cache["cash"] + invested + unrealized, 2),
        "cash": round(_portfolio_cache["cash"], 2),
        "invested": round(invested, 2),
        "realized_pnl": round(_portfolio_cache["realized_pnl"], 2),
        "unrealized_pnl": round(unrealized, 2),
        "total_trades": total_trades,
        "winning_trades": winning,
        "losing_trades": losing,
        "win_rate": round(winning / total_trades * 100, 1) if total_trades > 0 else 0,
        "positions": list(positions.values()),
    }


def set_portfolio_value(total_value: float, cash: Optional[float] = None):
    _portfolio_cache["total_value"] = total_value
    if cash is not None:
        _portfolio_cache["cash"] = cash
    else:
        _portfolio_cache["cash"] = total_value - _portfolio_cache["invested"]


def execute_trade(symbol: str, direction: str, shares: int, price: float, notes: str = "") -> dict:
    positions = _portfolio_cache["positions"]

    if direction == "BUY":
        cost = shares * price
        if cost > _portfolio_cache["cash"]:
            return {"error": f"Insufficient cash. Need ${cost:.2f}, have ${_portfolio_cache['cash']:.2f}"}

        _portfolio_cache["cash"] -= cost

        if symbol in positions:
            existing = positions[symbol]
            total_shares = existing["shares"] + shares
            avg_price = (existing["shares"] * existing["avg_entry_price"] + cost) / total_shares
            positions[symbol]["shares"] = total_shares
            positions[symbol]["avg_entry_price"] = round(avg_price, 2)
        else:
            positions[symbol] = {
                "symbol": symbol,
                "shares": shares,
                "avg_entry_price": round(price, 2),
                "current_price": round(price, 2),
                "unrealized_pnl": 0,
                "unrealized_pnl_pct": 0,
                "opened_at": datetime.now().isoformat(),
            }

        _portfolio_cache["trade_history"].append({
            "symbol": symbol,
            "direction": "BUY",
            "shares": shares,
            "price": price,
            "value": cost,
            "timestamp": datetime.now().isoformat(),
            "notes": notes,
        })

        return {"success": True, "message": f"Bought {shares} shares of {symbol} at ${price:.2f}"}

    elif direction == "SELL":
        if symbol not in positions:
            return {"error": f"No position in {symbol}"}

        pos = positions[symbol]
        sell_shares = min(shares, pos["shares"])
        revenue = sell_shares * price
        cost_basis = sell_shares * pos["avg_entry_price"]
        pnl = revenue - cost_basis
        pnl_pct = (price / pos["avg_entry_price"] - 1) * 100

        _portfolio_cache["cash"] += revenue
        _portfolio_cache["realized_pnl"] += pnl

        remaining = pos["shares"] - sell_shares
        if remaining <= 0:
            del positions[symbol]
        else:
            positions[symbol]["shares"] = remaining

        _portfolio_cache["trade_history"].append({
            "symbol": symbol,
            "direction": "SELL",
            "shares": sell_shares,
            "price": price,
            "value": revenue,
            "pnl": round(pnl, 2),
            "pnl_pct": round(pnl_pct, 2),
            "timestamp": datetime.now().isoformat(),
            "notes": notes,
        })

        return {
            "success": True,
            "message": f"Sold {sell_shares} shares of {symbol} at ${price:.2f} (P&L: ${pnl:.2f}, {pnl_pct:.1f}%)",
        }

    return {"error": "Invalid direction"}


def update_position_prices(quotes: list[dict]):
    positions = _portfolio_cache["positions"]
    for quote in quotes:
        symbol = quote["symbol"]
        if symbol in positions:
            price = quote["price"]
            pos = positions[symbol]
            pos["current_price"] = price
            pos["unrealized_pnl"] = round((price - pos["avg_entry_price"]) * pos["shares"], 2)
            pos["unrealized_pnl_pct"] = round((price / pos["avg_entry_price"] - 1) * 100, 2)


def check_stop_loss_take_profit(quotes: list[dict]) -> list[dict]:
    """Check if any positions hit stop loss or take profit."""
    alerts = []
    positions = _portfolio_cache["positions"]

    for quote in quotes:
        symbol = quote["symbol"]
        if symbol not in positions:
            continue

        pos = positions[symbol]
        price = quote["price"]
        entry = pos["avg_entry_price"]
        loss_pct = (price / entry - 1) * 100

        if loss_pct <= -settings.stop_loss_pct * 100:
            alerts.append({
                "type": "STOP_LOSS",
                "symbol": symbol,
                "message": f"STOP LOSS triggered for {symbol}: down {loss_pct:.1f}% (entry ${entry:.2f}, current ${price:.2f})",
                "urgency": "HIGH",
            })
        elif loss_pct >= settings.take_profit_pct * 100:
            alerts.append({
                "type": "TAKE_PROFIT",
                "symbol": symbol,
                "message": f"TAKE PROFIT reached for {symbol}: up {loss_pct:.1f}% (entry ${entry:.2f}, current ${price:.2f})",
                "urgency": "MEDIUM",
            })
        elif loss_pct <= -(settings.stop_loss_pct * 100 * 0.7):
            alerts.append({
                "type": "WARNING",
                "symbol": symbol,
                "message": f"WARNING: {symbol} approaching stop loss, down {loss_pct:.1f}%",
                "urgency": "LOW",
            })

    return alerts


def generate_recommendations(signals: list[dict]) -> list[dict]:
    """Convert actionable signals into concrete trade recommendations."""
    portfolio = get_portfolio()
    available_cash = portfolio["cash"]
    recommendations = []

    for signal in signals:
        if signal["direction"] == "HOLD":
            continue
        if signal["confidence"] < settings.min_signal_confidence:
            continue

        price = signal["entry_price"]
        if not price:
            continue

        if signal["direction"] == "BUY":
            max_investment = min(
                available_cash * 0.25,
                settings.default_portfolio_value * settings.max_position_pct,
            )
            shares = int(max_investment / price)
            if shares <= 0:
                continue

            available_cash -= shares * price

        elif signal["direction"] == "SELL":
            positions = _portfolio_cache["positions"]
            if signal["symbol"] not in positions:
                continue
            shares = positions[signal["symbol"]]["shares"]

        recommendations.append({
            "symbol": signal["symbol"],
            "direction": signal["direction"],
            "shares": shares,
            "entry_price": price,
            "target_price": signal.get("target_price"),
            "stop_loss_price": signal.get("stop_loss_price"),
            "estimated_value": round(shares * price, 2),
            "confidence": signal["confidence"],
            "rationale": signal.get("rationale", ""),
            "status": "RECOMMENDED",
            "created_at": datetime.now().isoformat(),
        })

    return recommendations
