from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class StockQuoteResponse(BaseModel):
    symbol: str
    price: float
    open_price: Optional[float] = None
    high: Optional[float] = None
    low: Optional[float] = None
    volume: Optional[int] = None
    prev_close: Optional[float] = None
    change_pct: Optional[float] = None
    market_cap: Optional[float] = None
    timestamp: Optional[datetime] = None


class NewsArticleResponse(BaseModel):
    title: str
    source: Optional[str] = None
    url: Optional[str] = None
    summary: Optional[str] = None
    symbols: list[str] = []
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None
    published_at: Optional[datetime] = None


class TechnicalIndicators(BaseModel):
    symbol: str
    rsi: Optional[float] = None
    rsi_signal: str = "NEUTRAL"
    macd: Optional[float] = None
    macd_signal_line: Optional[float] = None
    macd_histogram: Optional[float] = None
    macd_signal: str = "NEUTRAL"
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    sma_signal: str = "NEUTRAL"
    bollinger_upper: Optional[float] = None
    bollinger_middle: Optional[float] = None
    bollinger_lower: Optional[float] = None
    bollinger_signal: str = "NEUTRAL"
    atr: Optional[float] = None
    adx: Optional[float] = None
    obv_trend: str = "NEUTRAL"
    overall_technical_score: float = 0.0  # -1.0 to 1.0
    current_price: Optional[float] = None


class SignalResponse(BaseModel):
    id: Optional[int] = None
    symbol: str
    direction: str
    strength: str
    confidence: float
    entry_price: Optional[float] = None
    target_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    position_size_pct: Optional[float] = None
    rationale: Optional[str] = None
    news_sentiment: Optional[float] = None
    technical_score: Optional[float] = None
    fundamental_score: Optional[float] = None
    created_at: Optional[datetime] = None
    is_active: bool = True


class RecommendationResponse(BaseModel):
    id: Optional[int] = None
    signal_id: Optional[int] = None
    symbol: str
    direction: str
    shares: int
    entry_price: float
    target_price: Optional[float] = None
    stop_loss_price: Optional[float] = None
    estimated_value: Optional[float] = None
    status: str = "RECOMMENDED"
    pnl: Optional[float] = None
    pnl_pct: Optional[float] = None
    created_at: Optional[datetime] = None
    rationale: Optional[str] = None


class PositionResponse(BaseModel):
    symbol: str
    shares: int
    avg_entry_price: float
    current_price: Optional[float] = None
    unrealized_pnl: Optional[float] = None
    unrealized_pnl_pct: Optional[float] = None
    opened_at: Optional[datetime] = None


class PortfolioResponse(BaseModel):
    total_value: float
    cash: float
    invested: float
    realized_pnl: float = 0.0
    unrealized_pnl: float = 0.0
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate: float = 0.0
    positions: list[PositionResponse] = []


class DashboardResponse(BaseModel):
    portfolio: PortfolioResponse
    active_signals: list[SignalResponse] = []
    recommendations: list[RecommendationResponse] = []
    recent_news: list[NewsArticleResponse] = []
    watchlist_quotes: list[StockQuoteResponse] = []
    last_updated: Optional[datetime] = None


class ExecuteTradeRequest(BaseModel):
    recommendation_id: int
    executed_price: float
    shares: Optional[int] = None
    notes: Optional[str] = None


class ClosePositionRequest(BaseModel):
    symbol: str
    closed_price: float
    shares: Optional[int] = None
    notes: Optional[str] = None


class WatchlistUpdate(BaseModel):
    symbols: list[str]


class PortfolioUpdate(BaseModel):
    total_value: float
    cash: Optional[float] = None
