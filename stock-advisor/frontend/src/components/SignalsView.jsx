import React from 'react'
import { formatCurrency, formatPct } from '../utils/format'

function ConfidenceBar({ value }) {
  const pct = Math.round((value || 0) * 100)
  let color = '#64748b'
  if (pct >= 70) color = '#22c55e'
  else if (pct >= 40) color = '#f59e0b'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div className="confidence-bar" style={{ width: 80 }}>
        <div
          className="confidence-bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="mono" style={{ fontSize: 12 }}>{pct}%</span>
    </div>
  )
}

export default function SignalsView({ signals, loading, onSelectSymbol }) {
  if (loading) {
    return <div className="loading"><div className="spinner" /> Scanning for signals...</div>
  }

  if (!signals) {
    return <div className="empty-state">Click "Scan Watchlist" to generate signals</div>
  }

  const { buy_signals = [], sell_signals = [], all_signals = [] } = signals

  return (
    <div>
      <div className="grid grid-3" style={{ marginBottom: 20 }}>
        <div className="card">
          <div className="card-title">Buy Signals</div>
          <div className="stat-value positive" style={{ marginTop: 8 }}>{buy_signals.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Sell Signals</div>
          <div className="stat-value negative" style={{ marginTop: 8 }}>{sell_signals.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Total Scanned</div>
          <div className="stat-value" style={{ marginTop: 8 }}>{signals.total_scanned || all_signals.length}</div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Symbol</th>
              <th>Signal</th>
              <th>Strength</th>
              <th>Confidence</th>
              <th>Price</th>
              <th>Target</th>
              <th>Stop Loss</th>
              <th>Technical</th>
              <th>Sentiment</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {all_signals
              .filter(s => s.direction !== 'HOLD' || s.confidence > 0.3)
              .map((s, i) => (
                <tr key={i}>
                  <td>
                    <span className="mono" style={{ fontWeight: 600 }}>{s.symbol}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${s.direction.toLowerCase()}`}>
                      {s.direction}
                    </span>
                  </td>
                  <td>
                    <span className={`badge badge-${(s.strength || '').toLowerCase()}`}>
                      {s.strength}
                    </span>
                  </td>
                  <td><ConfidenceBar value={s.confidence} /></td>
                  <td className="mono">{formatCurrency(s.entry_price)}</td>
                  <td className="mono positive">{formatCurrency(s.target_price)}</td>
                  <td className="mono negative">{formatCurrency(s.stop_loss_price)}</td>
                  <td>
                    <span className={`mono ${s.technical_score > 0 ? 'positive' : s.technical_score < 0 ? 'negative' : ''}`}>
                      {s.technical_score?.toFixed(2) || '—'}
                    </span>
                  </td>
                  <td>
                    <span className={`mono ${s.news_sentiment > 0 ? 'positive' : s.news_sentiment < 0 ? 'negative' : ''}`}>
                      {s.news_sentiment?.toFixed(2) || '—'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => onSelectSymbol(s.symbol)}
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
