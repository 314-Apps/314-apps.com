import React from 'react'
import { formatCurrency, formatPct } from '../utils/format'

export default function Recommendations({ recommendations, loading }) {
  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Generating trade recommendations...
      </div>
    )
  }

  if (!recommendations || recommendations.length === 0) {
    return (
      <div className="empty-state">
        <p style={{ fontSize: 18, marginBottom: 8 }}>No actionable recommendations right now</p>
        <p>The system will surface BUY/SELL signals when confidence is high enough.</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="section-title">
        Active Recommendations ({recommendations.length})
      </h2>
      {recommendations.map((rec, i) => (
        <div
          key={i}
          className={`recommendation-card ${rec.direction.toLowerCase()}`}
        >
          <div className="rec-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span className="rec-symbol">{rec.symbol}</span>
              <span className={`badge badge-${rec.direction.toLowerCase()}`}>
                {rec.direction}
              </span>
              {rec.confidence && (
                <span className={`badge badge-${
                  rec.confidence >= 0.7 ? 'strong' : rec.confidence >= 0.4 ? 'moderate' : 'weak'
                }`}>
                  {(rec.confidence * 100).toFixed(0)}% confidence
                </span>
              )}
            </div>
          </div>

          <div className="rec-details">
            <div>
              <div className="rec-detail-label">Entry Price</div>
              <div className="rec-detail-value">{formatCurrency(rec.entry_price)}</div>
            </div>
            <div>
              <div className="rec-detail-label">Shares</div>
              <div className="rec-detail-value">{rec.shares}</div>
            </div>
            <div>
              <div className="rec-detail-label">Est. Value</div>
              <div className="rec-detail-value">{formatCurrency(rec.estimated_value)}</div>
            </div>
            {rec.target_price && (
              <div>
                <div className="rec-detail-label">Target</div>
                <div className="rec-detail-value positive">
                  {formatCurrency(rec.target_price)}
                </div>
              </div>
            )}
            {rec.stop_loss_price && (
              <div>
                <div className="rec-detail-label">Stop Loss</div>
                <div className="rec-detail-value negative">
                  {formatCurrency(rec.stop_loss_price)}
                </div>
              </div>
            )}
          </div>

          {rec.rationale && (
            <div className="rationale">
              {rec.rationale.split(' | ').map((r, j) => (
                <div key={j} style={{ marginBottom: j < rec.rationale.split(' | ').length - 1 ? 4 : 0 }}>
                  {r}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
