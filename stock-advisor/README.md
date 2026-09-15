# Stock Trading Advisor

An AI-powered stock trading recommendation system for NYSE stocks. It analyzes live market data, financial news sentiment, and technical indicators to generate actionable buy/sell recommendations with specific entry prices, targets, stop losses, and position sizes.

**You execute all trades manually on Fidelity** — this app tells you *what* to trade and *when*.

## How It Works

The system combines three analysis engines to generate trading signals:

### 1. Technical Analysis (45% weight)
- **RSI** (Relative Strength Index) — identifies oversold/overbought conditions
- **MACD** — detects momentum shifts and trend changes
- **Moving Averages** (SMA 20/50/200) — determines trend direction and strength
- **Bollinger Bands** — identifies mean-reversion opportunities
- **Stochastic Oscillator** — confirms momentum signals
- **OBV** (On Balance Volume) — validates price moves with volume
- **ADX** — measures trend strength
- **Support/Resistance levels** — key price levels for entries and exits

### 2. News Sentiment Analysis (35% weight)
- Aggregates news from Yahoo Finance, MarketWatch, CNBC, Reuters, and more
- Dual sentiment engine: VADER (financial-tuned) + TextBlob
- Custom financial lexicon with 50+ terms (upgrade, downgrade, beat, miss, etc.)
- Per-stock sentiment scoring across all relevant articles
- Confidence-weighted aggregation

### 3. Fundamental/Momentum Score (20% weight)
- Daily price momentum
- Volume analysis vs. 90-day average
- Directional confirmation

### Signal Generation
All three scores are combined into a single confidence-weighted signal:
- **BUY** — combined score > 0.15 with confidence >= 60%
- **SELL** — combined score < -0.15 with confidence >= 60%
- **HOLD** — insufficient signal strength

### Risk Management
- **Position sizing** based on 2% risk-per-trade rule
- **Max 10%** of portfolio in any single stock
- **Max 80%** total market exposure
- **7% stop loss** and **15% take profit** defaults
- Stop loss/take profit alerts when positions approach levels

## Default Watchlist (37 NYSE stocks)

Tech: AAPL, MSFT, GOOGL, AMZN, META, NVDA, TSLA, CRM, ORCL, ADBE, INTC, AMD  
Finance: JPM, BAC, WFC, GS, MS, V, MA, PYPL  
Healthcare: JNJ, UNH, PFE, MRK, ABBV  
Energy: XOM, CVX, COP  
Consumer: HD, WMT, COST, TGT, DIS, NFLX, CMCSA  
Industrial: BA, CAT, GE, HON

## Quick Start

### Option 1: Run script (recommended)
```bash
cd stock-advisor
chmod +x run.sh
./run.sh
```

### Option 2: Manual setup
```bash
cd stock-advisor

# Backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend
cd frontend
npm install
npm run build
cd ..

# Run
python main.py
```

### Option 3: Docker
```bash
cd stock-advisor
docker build -t stock-advisor .
docker run -p 8000:8000 stock-advisor
```

Then open **http://localhost:8000** for the dashboard or **http://localhost:8000/docs** for the API.

## Usage Workflow

1. **Open the dashboard** — see your portfolio summary, watchlist quotes, and latest news
2. **Click "Scan for Signals"** — runs technical + sentiment analysis across all watchlist stocks
3. **Click "Get Recommendations"** — generates specific trade recommendations with entry/target/stop
4. **Review recommendations** — check the rationale, confidence level, and price targets
5. **Click any stock** — drill into full technical analysis, support/resistance levels, and related news
6. **Execute on Fidelity** — place the trade manually on your Fidelity account
7. **Record the trade** — go to the Positions tab and log your execution price
8. **Monitor positions** — the app tracks P&L and alerts you on stop loss / take profit levels

## Configuration

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Key settings:
- `SA_DEFAULT_PORTFOLIO_VALUE` — your total portfolio value (default: $100,000)
- `SA_STOP_LOSS_PCT` — stop loss percentage (default: 7%)
- `SA_TAKE_PROFIT_PCT` — take profit percentage (default: 15%)
- `SA_MIN_SIGNAL_CONFIDENCE` — minimum confidence to recommend (default: 60%)
- `SA_TECHNICAL_WEIGHT` / `SA_SENTIMENT_WEIGHT` / `SA_FUNDAMENTAL_WEIGHT` — analysis weights

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/dashboard` | Full dashboard data (portfolio, quotes, news, alerts) |
| `GET /api/signals` | Scan watchlist and generate all signals |
| `GET /api/signals/{symbol}` | Signal for a specific stock |
| `GET /api/recommendations` | Actionable trade recommendations |
| `GET /api/analysis/{symbol}` | Deep analysis for one stock |
| `GET /api/technicals/{symbol}` | Technical indicators only |
| `GET /api/quotes` | Current quotes for watchlist |
| `GET /api/quotes/{symbol}` | Quote for one stock |
| `GET /api/news` | Aggregated market news with sentiment |
| `GET /api/portfolio` | Current portfolio state |
| `POST /api/trade/buy` | Record a buy trade |
| `POST /api/trade/sell` | Record a sell trade |
| `POST /api/portfolio/update` | Update portfolio value |
| `POST /api/watchlist` | Update watchlist symbols |

## Architecture

```
stock-advisor/
├── main.py                         # FastAPI app entry point
├── config/
│   └── settings.py                 # All configurable parameters
├── backend/
│   ├── api/
│   │   └── routes.py               # REST API endpoints
│   ├── analysis/
│   │   ├── technical.py            # Technical indicator computation
│   │   └── signal_generator.py     # Combined signal generation
│   ├── models/
│   │   ├── database.py             # SQLAlchemy async setup
│   │   ├── schemas.py              # Database models
│   │   └── pydantic_models.py      # API request/response models
│   └── services/
│       ├── market_data.py          # Yahoo Finance integration
│       ├── news_service.py         # RSS news aggregation
│       ├── sentiment_analyzer.py   # VADER + TextBlob analysis
│       └── portfolio_manager.py    # Position & risk management
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Main dashboard app
│   │   ├── components/             # React UI components
│   │   ├── hooks/                  # API hooks
│   │   ├── utils/                  # Formatting helpers
│   │   └── styles/                 # Global CSS
│   └── index.html
├── requirements.txt
├── Dockerfile
├── run.sh
└── .env.example
```

## Disclaimer

This software is for educational and informational purposes only. It is **not financial advice**. Trading stocks involves substantial risk of loss. The recommendations generated by this system are based on algorithmic analysis and may not account for all market conditions. Always do your own research, and consider consulting a licensed financial advisor. Past performance does not guarantee future results. Trade at your own risk.
