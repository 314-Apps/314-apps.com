from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from textblob import TextBlob
import re
import logging

logger = logging.getLogger(__name__)
vader = SentimentIntensityAnalyzer()

FINANCE_LEXICON = {
    "upgrade": 2.5,
    "downgrade": -2.5,
    "outperform": 2.0,
    "underperform": -2.0,
    "buy": 1.5,
    "sell": -1.5,
    "overweight": 1.5,
    "underweight": -1.5,
    "bullish": 2.0,
    "bearish": -2.0,
    "beat": 1.8,
    "miss": -1.8,
    "exceeded": 2.0,
    "disappointing": -2.0,
    "record revenue": 2.5,
    "revenue decline": -2.5,
    "guidance raised": 2.5,
    "guidance lowered": -2.5,
    "guidance cut": -2.5,
    "dividend increase": 2.0,
    "dividend cut": -2.5,
    "buyback": 1.5,
    "share repurchase": 1.5,
    "layoffs": -2.0,
    "restructuring": -1.0,
    "expansion": 1.5,
    "acquisition": 1.0,
    "merger": 0.5,
    "bankruptcy": -3.5,
    "default": -3.0,
    "lawsuit": -1.5,
    "investigation": -1.5,
    "fine": -1.5,
    "recall": -2.0,
    "shortage": -1.5,
    "surplus": 0.5,
    "inflation": -0.5,
    "rate hike": -1.0,
    "rate cut": 1.0,
    "recession": -2.5,
    "recovery": 1.5,
    "surge": 2.0,
    "plunge": -2.5,
    "rally": 2.0,
    "crash": -3.0,
    "breakout": 2.0,
    "breakdown": -2.0,
    "all-time high": 2.0,
    "52-week low": -2.0,
}

vader.lexicon.update(FINANCE_LEXICON)


def analyze_sentiment(text: str) -> dict:
    if not text or not text.strip():
        return {"score": 0.0, "label": "NEUTRAL", "confidence": 0.0}

    clean_text = re.sub(r'http\S+', '', text)
    clean_text = re.sub(r'[^\w\s\-\.\,\!\?]', ' ', clean_text)

    vader_scores = vader.polarity_scores(clean_text)
    vader_compound = vader_scores["compound"]

    blob = TextBlob(clean_text)
    textblob_polarity = blob.sentiment.polarity

    # Weighted average: VADER is better for financial text
    combined = 0.7 * vader_compound + 0.3 * textblob_polarity

    combined = max(-1.0, min(1.0, combined))

    if combined >= 0.25:
        label = "POSITIVE"
    elif combined <= -0.25:
        label = "NEGATIVE"
    else:
        label = "NEUTRAL"

    confidence = abs(combined)

    return {
        "score": round(combined, 4),
        "label": label,
        "confidence": round(confidence, 4),
        "vader_compound": round(vader_compound, 4),
        "textblob_polarity": round(textblob_polarity, 4),
    }


def analyze_news_batch(articles: list[dict]) -> list[dict]:
    for article in articles:
        text = f"{article.get('title', '')} {article.get('summary', '')}"
        sentiment = analyze_sentiment(text)
        article["sentiment_score"] = sentiment["score"]
        article["sentiment_label"] = sentiment["label"]
        article["sentiment_confidence"] = sentiment["confidence"]
    return articles


def get_aggregate_sentiment(articles: list[dict], symbol: str) -> dict:
    """Get weighted sentiment for a specific stock across all relevant articles."""
    relevant = [
        a for a in articles
        if symbol in a.get("symbols", [])
    ]

    if not relevant:
        return {"score": 0.0, "label": "NEUTRAL", "count": 0, "confidence": 0.0}

    total_weight = 0
    weighted_score = 0

    for article in relevant:
        score = article.get("sentiment_score", 0)
        conf = article.get("sentiment_confidence", 0.5)
        weight = conf
        weighted_score += score * weight
        total_weight += weight

    avg_score = weighted_score / total_weight if total_weight > 0 else 0
    avg_score = max(-1.0, min(1.0, avg_score))

    if avg_score >= 0.15:
        label = "POSITIVE"
    elif avg_score <= -0.15:
        label = "NEGATIVE"
    else:
        label = "NEUTRAL"

    return {
        "score": round(avg_score, 4),
        "label": label,
        "count": len(relevant),
        "confidence": round(min(1.0, len(relevant) / 5.0 * abs(avg_score)), 4),
    }
