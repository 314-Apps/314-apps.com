from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    app_name: str = "Stock Trading Advisor"
    debug: bool = False

    # API keys (optional - app works with free data sources by default)
    newsapi_key: Optional[str] = None
    alpha_vantage_key: Optional[str] = None
    finnhub_key: Optional[str] = None

    # Database
    database_url: str = "sqlite+aiosqlite:///./stock_advisor.db"

    # Trading parameters
    default_portfolio_value: float = 100000.0
    max_position_pct: float = 0.10  # max 10% of portfolio in one stock
    max_total_exposure_pct: float = 0.80  # max 80% invested at any time
    stop_loss_pct: float = 0.07  # 7% stop loss
    take_profit_pct: float = 0.15  # 15% take profit
    min_signal_confidence: float = 0.60  # minimum confidence to recommend

    # NYSE trading hours (Eastern Time)
    market_open_hour: int = 9
    market_open_minute: int = 30
    market_close_hour: int = 16
    market_close_minute: int = 0

    # Analysis parameters
    lookback_days: int = 90
    news_lookback_hours: int = 48
    sentiment_weight: float = 0.35
    technical_weight: float = 0.45
    fundamental_weight: float = 0.20

    # Watchlist - NYSE blue chips + high-volume stocks
    default_watchlist: list[str] = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA",
        "JPM", "BAC", "WFC", "GS", "MS",
        "JNJ", "UNH", "PFE", "MRK", "ABBV",
        "XOM", "CVX", "COP",
        "HD", "WMT", "COST", "TGT",
        "DIS", "NFLX", "CMCSA",
        "V", "MA", "PYPL",
        "BA", "CAT", "GE", "HON",
        "CRM", "ORCL", "ADBE", "INTC", "AMD"
    ]

    # Refresh intervals (seconds)
    quote_refresh_interval: int = 60
    news_refresh_interval: int = 300
    analysis_refresh_interval: int = 600

    model_config = {"env_file": ".env", "env_prefix": "SA_"}


settings = Settings()
