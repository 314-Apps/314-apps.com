from sqlalchemy import Column, String, Float, DateTime, Integer, Boolean, Text, Enum as SAEnum
from sqlalchemy.sql import func
from datetime import datetime
from .database import Base
import enum


class SignalDirection(str, enum.Enum):
    BUY = "BUY"
    SELL = "SELL"
    HOLD = "HOLD"


class SignalStrength(str, enum.Enum):
    STRONG = "STRONG"
    MODERATE = "MODERATE"
    WEAK = "WEAK"


class TradeStatus(str, enum.Enum):
    RECOMMENDED = "RECOMMENDED"
    EXECUTED = "EXECUTED"
    SKIPPED = "SKIPPED"
    CLOSED = "CLOSED"


class StockQuote(Base):
    __tablename__ = "stock_quotes"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(10), nullable=False, index=True)
    price = Column(Float, nullable=False)
    open_price = Column(Float)
    high = Column(Float)
    low = Column(Float)
    volume = Column(Integer)
    prev_close = Column(Float)
    change_pct = Column(Float)
    market_cap = Column(Float)
    timestamp = Column(DateTime, default=func.now(), index=True)


class NewsArticle(Base):
    __tablename__ = "news_articles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(500), nullable=False)
    source = Column(String(200))
    url = Column(String(1000))
    summary = Column(Text)
    symbols = Column(String(200))  # comma-separated
    sentiment_score = Column(Float)  # -1.0 to 1.0
    sentiment_label = Column(String(20))
    published_at = Column(DateTime)
    fetched_at = Column(DateTime, default=func.now())


class TradingSignal(Base):
    __tablename__ = "trading_signals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(10), nullable=False, index=True)
    direction = Column(SAEnum(SignalDirection), nullable=False)
    strength = Column(SAEnum(SignalStrength), nullable=False)
    confidence = Column(Float, nullable=False)  # 0.0 to 1.0
    entry_price = Column(Float)
    target_price = Column(Float)
    stop_loss_price = Column(Float)
    position_size_pct = Column(Float)  # % of portfolio
    rationale = Column(Text)
    news_sentiment = Column(Float)
    technical_score = Column(Float)
    fundamental_score = Column(Float)
    created_at = Column(DateTime, default=func.now(), index=True)
    expires_at = Column(DateTime)
    is_active = Column(Boolean, default=True)


class TradeRecommendation(Base):
    __tablename__ = "trade_recommendations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    signal_id = Column(Integer, nullable=False)
    symbol = Column(String(10), nullable=False, index=True)
    direction = Column(SAEnum(SignalDirection), nullable=False)
    shares = Column(Integer, nullable=False)
    entry_price = Column(Float, nullable=False)
    target_price = Column(Float)
    stop_loss_price = Column(Float)
    estimated_value = Column(Float)
    status = Column(SAEnum(TradeStatus), default=TradeStatus.RECOMMENDED)
    executed_price = Column(Float)
    executed_at = Column(DateTime)
    closed_price = Column(Float)
    closed_at = Column(DateTime)
    pnl = Column(Float)
    pnl_pct = Column(Float)
    created_at = Column(DateTime, default=func.now())
    notes = Column(Text)


class PortfolioState(Base):
    __tablename__ = "portfolio_state"

    id = Column(Integer, primary_key=True, autoincrement=True)
    total_value = Column(Float, nullable=False)
    cash = Column(Float, nullable=False)
    invested = Column(Float, nullable=False)
    realized_pnl = Column(Float, default=0.0)
    unrealized_pnl = Column(Float, default=0.0)
    total_trades = Column(Integer, default=0)
    winning_trades = Column(Integer, default=0)
    losing_trades = Column(Integer, default=0)
    timestamp = Column(DateTime, default=func.now())


class Position(Base):
    __tablename__ = "positions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(10), nullable=False, index=True)
    shares = Column(Integer, nullable=False)
    avg_entry_price = Column(Float, nullable=False)
    current_price = Column(Float)
    unrealized_pnl = Column(Float)
    unrealized_pnl_pct = Column(Float)
    opened_at = Column(DateTime, default=func.now())
    recommendation_id = Column(Integer)
