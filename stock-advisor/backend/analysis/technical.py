import pandas as pd
import numpy as np
import ta
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def compute_indicators(df: pd.DataFrame) -> dict:
    """Compute comprehensive technical indicators from OHLCV data."""
    if df.empty or len(df) < 20:
        return {"overall_technical_score": 0.0}

    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    volume = df["Volume"]
    current_price = float(close.iloc[-1])

    indicators = {"current_price": current_price}
    signals = []

    # --- RSI (14) ---
    try:
        rsi_indicator = ta.momentum.RSIIndicator(close, window=14)
        rsi = float(rsi_indicator.rsi().iloc[-1])
        indicators["rsi"] = round(rsi, 2)

        if rsi < 30:
            indicators["rsi_signal"] = "OVERSOLD_BUY"
            signals.append(0.8)
        elif rsi < 40:
            indicators["rsi_signal"] = "LEANING_BUY"
            signals.append(0.3)
        elif rsi > 70:
            indicators["rsi_signal"] = "OVERBOUGHT_SELL"
            signals.append(-0.8)
        elif rsi > 60:
            indicators["rsi_signal"] = "LEANING_SELL"
            signals.append(-0.3)
        else:
            indicators["rsi_signal"] = "NEUTRAL"
            signals.append(0.0)
    except Exception as e:
        logger.debug(f"RSI error: {e}")
        indicators["rsi"] = None
        indicators["rsi_signal"] = "NEUTRAL"

    # --- MACD ---
    try:
        macd_ind = ta.trend.MACD(close)
        macd_line = float(macd_ind.macd().iloc[-1])
        signal_line = float(macd_ind.macd_signal().iloc[-1])
        histogram = float(macd_ind.macd_diff().iloc[-1])

        indicators["macd"] = round(macd_line, 4)
        indicators["macd_signal_line"] = round(signal_line, 4)
        indicators["macd_histogram"] = round(histogram, 4)

        prev_hist = float(macd_ind.macd_diff().iloc[-2]) if len(macd_ind.macd_diff()) > 1 else 0

        if histogram > 0 and prev_hist <= 0:
            indicators["macd_signal"] = "BULLISH_CROSS"
            signals.append(0.9)
        elif histogram < 0 and prev_hist >= 0:
            indicators["macd_signal"] = "BEARISH_CROSS"
            signals.append(-0.9)
        elif histogram > 0 and histogram > prev_hist:
            indicators["macd_signal"] = "BULLISH_MOMENTUM"
            signals.append(0.5)
        elif histogram < 0 and histogram < prev_hist:
            indicators["macd_signal"] = "BEARISH_MOMENTUM"
            signals.append(-0.5)
        else:
            indicators["macd_signal"] = "NEUTRAL"
            signals.append(0.0)
    except Exception as e:
        logger.debug(f"MACD error: {e}")
        indicators["macd_signal"] = "NEUTRAL"

    # --- Moving Averages ---
    try:
        sma_20 = float(close.rolling(20).mean().iloc[-1])
        sma_50 = float(close.rolling(50).mean().iloc[-1]) if len(close) >= 50 else None
        sma_200 = float(close.rolling(200).mean().iloc[-1]) if len(close) >= 200 else None

        indicators["sma_20"] = round(sma_20, 2)
        indicators["sma_50"] = round(sma_50, 2) if sma_50 else None
        indicators["sma_200"] = round(sma_200, 2) if sma_200 else None

        ma_score = 0
        count = 0

        if current_price > sma_20:
            ma_score += 0.4
        else:
            ma_score -= 0.4
        count += 1

        if sma_50:
            if current_price > sma_50:
                ma_score += 0.5
            else:
                ma_score -= 0.5
            count += 1

            # Golden/Death cross
            if sma_20 > sma_50:
                ma_score += 0.3
            else:
                ma_score -= 0.3

        if sma_200:
            if current_price > sma_200:
                ma_score += 0.6
            else:
                ma_score -= 0.6
            count += 1

        if count > 0:
            ma_signal = ma_score / count
            if ma_signal > 0.3:
                indicators["sma_signal"] = "BULLISH"
            elif ma_signal < -0.3:
                indicators["sma_signal"] = "BEARISH"
            else:
                indicators["sma_signal"] = "NEUTRAL"
            signals.append(max(-1, min(1, ma_signal)))
        else:
            indicators["sma_signal"] = "NEUTRAL"
    except Exception as e:
        logger.debug(f"SMA error: {e}")
        indicators["sma_signal"] = "NEUTRAL"

    # --- Bollinger Bands ---
    try:
        bb = ta.volatility.BollingerBands(close, window=20, window_dev=2)
        indicators["bollinger_upper"] = round(float(bb.bollinger_hband().iloc[-1]), 2)
        indicators["bollinger_middle"] = round(float(bb.bollinger_mavg().iloc[-1]), 2)
        indicators["bollinger_lower"] = round(float(bb.bollinger_lband().iloc[-1]), 2)

        bb_pct = float(bb.bollinger_pband().iloc[-1])

        if bb_pct < 0:
            indicators["bollinger_signal"] = "OVERSOLD_BUY"
            signals.append(0.7)
        elif bb_pct < 0.2:
            indicators["bollinger_signal"] = "LEANING_BUY"
            signals.append(0.3)
        elif bb_pct > 1.0:
            indicators["bollinger_signal"] = "OVERBOUGHT_SELL"
            signals.append(-0.7)
        elif bb_pct > 0.8:
            indicators["bollinger_signal"] = "LEANING_SELL"
            signals.append(-0.3)
        else:
            indicators["bollinger_signal"] = "NEUTRAL"
            signals.append(0.0)
    except Exception as e:
        logger.debug(f"Bollinger error: {e}")
        indicators["bollinger_signal"] = "NEUTRAL"

    # --- ATR (volatility) ---
    try:
        atr_ind = ta.volatility.AverageTrueRange(high, low, close, window=14)
        indicators["atr"] = round(float(atr_ind.average_true_range().iloc[-1]), 4)
    except Exception:
        indicators["atr"] = None

    # --- ADX (trend strength) ---
    try:
        adx_ind = ta.trend.ADXIndicator(high, low, close, window=14)
        indicators["adx"] = round(float(adx_ind.adx().iloc[-1]), 2)
    except Exception:
        indicators["adx"] = None

    # --- OBV trend ---
    try:
        obv = ta.volume.OnBalanceVolumeIndicator(close, volume)
        obv_values = obv.on_balance_volume()
        if len(obv_values) >= 10:
            obv_sma = obv_values.rolling(10).mean()
            if float(obv_values.iloc[-1]) > float(obv_sma.iloc[-1]):
                indicators["obv_trend"] = "BULLISH"
                signals.append(0.3)
            else:
                indicators["obv_trend"] = "BEARISH"
                signals.append(-0.3)
        else:
            indicators["obv_trend"] = "NEUTRAL"
    except Exception:
        indicators["obv_trend"] = "NEUTRAL"

    # --- Stochastic Oscillator ---
    try:
        stoch = ta.momentum.StochasticOscillator(high, low, close, window=14, smooth_window=3)
        stoch_k = float(stoch.stoch().iloc[-1])
        stoch_d = float(stoch.stoch_signal().iloc[-1])

        if stoch_k < 20 and stoch_k > stoch_d:
            signals.append(0.6)
        elif stoch_k > 80 and stoch_k < stoch_d:
            signals.append(-0.6)
        else:
            signals.append(0.0)
    except Exception:
        pass

    # --- Overall Score ---
    if signals:
        overall = sum(signals) / len(signals)
        indicators["overall_technical_score"] = round(max(-1.0, min(1.0, overall)), 4)
    else:
        indicators["overall_technical_score"] = 0.0

    return indicators


def compute_support_resistance(df: pd.DataFrame, num_levels: int = 3) -> dict:
    """Identify key support and resistance levels."""
    if df.empty or len(df) < 20:
        return {"support": [], "resistance": []}

    close = df["Close"]
    high = df["High"]
    low = df["Low"]
    current = float(close.iloc[-1])

    pivots_high = []
    pivots_low = []

    for i in range(2, len(df) - 2):
        if float(high.iloc[i]) > float(high.iloc[i-1]) and float(high.iloc[i]) > float(high.iloc[i+1]):
            if float(high.iloc[i]) > float(high.iloc[i-2]) and float(high.iloc[i]) > float(high.iloc[i+2]):
                pivots_high.append(float(high.iloc[i]))

        if float(low.iloc[i]) < float(low.iloc[i-1]) and float(low.iloc[i]) < float(low.iloc[i+1]):
            if float(low.iloc[i]) < float(low.iloc[i-2]) and float(low.iloc[i]) < float(low.iloc[i+2]):
                pivots_low.append(float(low.iloc[i]))

    support = sorted([p for p in pivots_low if p < current], reverse=True)[:num_levels]
    resistance = sorted([p for p in pivots_high if p > current])[:num_levels]

    return {
        "support": [round(s, 2) for s in support],
        "resistance": [round(r, 2) for r in resistance],
    }


def compute_trend(df: pd.DataFrame) -> dict:
    """Determine overall trend direction and strength."""
    if df.empty or len(df) < 20:
        return {"direction": "NEUTRAL", "strength": 0}

    close = df["Close"]
    returns = close.pct_change().dropna()

    sma_short = close.rolling(10).mean()
    sma_long = close.rolling(30).mean()

    trend_score = 0

    if float(sma_short.iloc[-1]) > float(sma_long.iloc[-1]):
        trend_score += 1
    else:
        trend_score -= 1

    recent_return = float((close.iloc[-1] / close.iloc[-20] - 1) * 100)
    if recent_return > 5:
        trend_score += 1
    elif recent_return < -5:
        trend_score -= 1

    higher_highs = 0
    for i in range(-5, -1):
        if float(close.iloc[i]) > float(close.iloc[i-1]):
            higher_highs += 1

    if higher_highs >= 3:
        trend_score += 1
    elif higher_highs <= 1:
        trend_score -= 1

    if trend_score >= 2:
        direction = "STRONG_UP"
    elif trend_score == 1:
        direction = "UP"
    elif trend_score <= -2:
        direction = "STRONG_DOWN"
    elif trend_score == -1:
        direction = "DOWN"
    else:
        direction = "NEUTRAL"

    return {
        "direction": direction,
        "strength": abs(trend_score),
        "recent_return_pct": round(recent_return, 2),
    }
