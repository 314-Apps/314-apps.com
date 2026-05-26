import React from 'react'
import { formatTime, sentimentColor } from '../utils/format'

export default function NewsFeed({ news, loading }) {
  if (loading) {
    return <div className="loading"><div className="spinner" /> Loading news...</div>
  }

  if (!news || news.length === 0) {
    return <div className="empty-state">No news articles found</div>
  }

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 12 }}>Market News & Sentiment</h3>
      {news.map((n, i) => (
        <div key={i} className="news-item">
          <div className="news-title">
            <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
          </div>
          <div className="news-meta">
            <span>{n.source}</span>
            <span>{formatTime(n.published_at)}</span>
            {n.symbols && n.symbols.length > 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                {n.symbols.join(', ')}
              </span>
            )}
            {n.sentiment_score != null && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span
                  className="sentiment-dot"
                  style={{ background: sentimentColor(n.sentiment_score) }}
                />
                {n.sentiment_label}
              </span>
            )}
          </div>
          {n.summary && (
            <div style={{ marginTop: 4, fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              {n.summary.length > 200 ? n.summary.slice(0, 200) + '...' : n.summary}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
