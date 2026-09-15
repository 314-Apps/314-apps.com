import React from 'react'
import { useApi } from '../hooks/useApi'
import { formatCurrency, formatPct, formatTime, sentimentColor } from '../utils/format'

export default function StockDetail({ symbol, onBack }) {
  const { data, loading, error } = useApi(`/analysis/${symbol}`)

  if (loading) {
    return <div className="loading"><div className="spinner" /> Analyzing {symbol}...</div>
  }

  if (error || !data) {
    return (
      <div className="card">
        <button className="btn btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>Back</button>
        <div className="empty-state">Failed to load analysis for {symbol}</div>
      </div>
    )
  }

  const { signal, technicals, support_resistance, trend, sentiment, relevant_news } = data

  return (
    <div>
      <button className="btn btn-sm" onClick={onBack} style={{ marginBottom: 16 }}>Back to Overview</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontSize: 28, fontFamily: 'var(--font-mono)' }}>{symbol}</h2>
        <span className="mono" style={{ fontSize: 24 }}>{formatCurrency(signal.entry_price)}</span>
        <span className={`badge badge-${signal.direction.toLowerCase()}`} style={{ fontSize: 14 }}>
          {signal.direction}
        </span>
        <span className={`badge badge-${(signal.strength || '').toLowerCase()}`}>
          {signal.strength}
        </span>
      </div>

      {/* Signal summary card */}
      {signal.direction !== 'HOLD' && (
        <div className={`recommendation-card ${signal.direction.toLowerCase()}`} style={{ marginBottom: 20 }}>
          <div className="rec-details">
            <div>
              <div className="rec-detail-label">Entry Price</div>
              <div className="rec-detail-value">{formatCurrency(signal.entry_price)}</div>
            </div>
            <div>
              <div className="rec-detail-label">Target</div>
              <div className="rec-detail-value positive">{formatCurrency(signal.target_price)}</div>
            </div>
            <div>
              <div className="rec-detail-label">Stop Loss</div>
              <div className="rec-detail-value negative">{formatCurrency(signal.stop_loss_price)}</div>
            </div>
            <div>
              <div className="rec-detail-label">Suggested Shares</div>
              <div className="rec-detail-value">{signal.suggested_shares}</div>
            </div>
            <div>
              <div className="rec-detail-label">Position Size</div>
              <div className="rec-detail-value">{signal.position_size_pct}%</div>
            </div>
            <div>
              <div className="rec-detail-label">Confidence</div>
              <div className="rec-detail-value">{(signal.confidence * 100).toFixed(0)}%</div>
            </div>
          </div>
          {signal.rationale && (
            <div className="rationale" style={{ marginTop: 16 }}>
              {signal.rationale.split(' | ').map((r, i) => <div key={i}>{r}</div>)}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-2" style={{ marginBottom: 20 }}>
        {/* Technical Indicators */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Technical Indicators</h3>
          <table>
            <tbody>
              {[
                ['RSI (14)', technicals.rsi?.toFixed(1), technicals.rsi_signal],
                ['MACD', technicals.macd?.toFixed(4), technicals.macd_signal],
                ['SMA 20', formatCurrency(technicals.sma_20), technicals.sma_signal],
                ['SMA 50', formatCurrency(technicals.sma_50), null],
                ['SMA 200', formatCurrency(technicals.sma_200), null],
                ['Bollinger', null, technicals.bollinger_signal],
                ['ADX', technicals.adx?.toFixed(1), technicals.adx > 25 ? 'TRENDING' : 'RANGE'],
                ['OBV', null, technicals.obv_trend],
                ['Overall Score', technicals.overall_technical_score?.toFixed(3), null],
              ].map(([label, val, sig], i) => (
                <tr key={i}>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</td>
                  <td className="mono">{val || '—'}</td>
                  <td>
                    {sig && (
                      <span style={{
                        fontSize: 11,
                        color: sig.includes('BULL') || sig.includes('BUY') || sig.includes('UP')
                          ? 'var(--green)'
                          : sig.includes('BEAR') || sig.includes('SELL') || sig.includes('DOWN')
                            ? 'var(--red)' : 'var(--text-muted)',
                      }}>
                        {sig}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Trend & Levels */}
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Trend & Key Levels</h3>

          <div style={{ marginBottom: 16 }}>
            <div className="rec-detail-label">Trend Direction</div>
            <div style={{
              fontSize: 18, fontWeight: 600, marginTop: 4,
              color: trend.direction.includes('UP') ? 'var(--green)' : trend.direction.includes('DOWN') ? 'var(--red)' : 'var(--text-secondary)',
            }}>
              {trend.direction} ({formatPct(trend.recent_return_pct)} / 20d)
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="rec-detail-label">Resistance Levels</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {(support_resistance.resistance || []).map((r, i) => (
                <span key={i} className="mono" style={{ color: 'var(--red)', fontSize: 14 }}>
                  {formatCurrency(r)}
                </span>
              ))}
              {(!support_resistance.resistance || support_resistance.resistance.length === 0) && (
                <span className="mono" style={{ color: 'var(--text-muted)' }}>None identified</span>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div className="rec-detail-label">Support Levels</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              {(support_resistance.support || []).map((s, i) => (
                <span key={i} className="mono" style={{ color: 'var(--green)', fontSize: 14 }}>
                  {formatCurrency(s)}
                </span>
              ))}
              {(!support_resistance.support || support_resistance.support.length === 0) && (
                <span className="mono" style={{ color: 'var(--text-muted)' }}>None identified</span>
              )}
            </div>
          </div>

          <div>
            <div className="rec-detail-label">News Sentiment</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <div
                className="sentiment-dot"
                style={{ background: sentimentColor(sentiment.score) }}
              />
              <span className="mono" style={{
                color: sentimentColor(sentiment.score),
                fontSize: 16, fontWeight: 600,
              }}>
                {sentiment.label} ({sentiment.score?.toFixed(2)})
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
                {sentiment.count} articles
              </span>
            </div>
          </div>

          <div style={{ marginTop: 16 }}>
            <div className="rec-detail-label">Score Breakdown</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Technical</span>
                <div className={`mono ${signal.technical_score > 0 ? 'positive' : signal.technical_score < 0 ? 'negative' : ''}`}>
                  {signal.technical_score?.toFixed(3)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sentiment</span>
                <div className={`mono ${signal.news_sentiment > 0 ? 'positive' : signal.news_sentiment < 0 ? 'negative' : ''}`}>
                  {signal.news_sentiment?.toFixed(3)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Fundamental</span>
                <div className={`mono ${signal.fundamental_score > 0 ? 'positive' : signal.fundamental_score < 0 ? 'negative' : ''}`}>
                  {signal.fundamental_score?.toFixed(3)}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Combined</span>
                <div className={`mono ${signal.combined_score > 0 ? 'positive' : signal.combined_score < 0 ? 'negative' : ''}`} style={{ fontWeight: 700 }}>
                  {signal.combined_score?.toFixed(3)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related News */}
      {relevant_news && relevant_news.length > 0 && (
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 12 }}>Related News</h3>
          {relevant_news.map((n, i) => (
            <div key={i} className="news-item">
              <div className="news-title">
                <a href={n.url} target="_blank" rel="noopener noreferrer">{n.title}</a>
              </div>
              <div className="news-meta">
                <span>{n.source}</span>
                <span>{formatTime(n.published_at)}</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="sentiment-dot" style={{ background: sentimentColor(n.sentiment_score) }} />
                  {n.sentiment_label} ({n.sentiment_score?.toFixed(2)})
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
