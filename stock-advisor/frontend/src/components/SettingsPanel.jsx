import React, { useState, useEffect } from 'react'
import { apiPost, apiGet } from '../hooks/useApi'
import { formatCurrency } from '../utils/format'

export default function SettingsPanel() {
  const [portfolioValue, setPortfolioValue] = useState(100000)
  const [cash, setCash] = useState(100000)
  const [watchlistText, setWatchlistText] = useState('')
  const [message, setMessage] = useState(null)

  useEffect(() => {
    apiGet('/portfolio').then(p => {
      setPortfolioValue(p.total_value)
      setCash(p.cash)
    }).catch(() => {})

    apiGet('/watchlist').then(w => {
      setWatchlistText((w.watchlist || []).join(', '))
    }).catch(() => {})
  }, [])

  const handlePortfolioUpdate = async () => {
    try {
      await apiPost('/portfolio/update', {
        total_value: Number(portfolioValue),
        cash: Number(cash),
      })
      setMessage({ type: 'success', text: 'Portfolio updated successfully' })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  const handleWatchlistUpdate = async () => {
    try {
      const symbols = watchlistText.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      await apiPost('/watchlist', { symbols })
      setMessage({ type: 'success', text: `Watchlist updated with ${symbols.length} symbols` })
    } catch (err) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  return (
    <div>
      {message && (
        <div className={`alert-card ${message.type === 'error' ? 'alert-high' : 'alert-medium'}`}
          style={{ marginBottom: 16 }}>
          {message.text}
        </div>
      )}

      <div className="grid grid-2">
        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Portfolio Configuration</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Total Portfolio Value ($)
            </label>
            <input
              type="number"
              value={portfolioValue}
              onChange={e => setPortfolioValue(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: 14,
              }}
            />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Available Cash ($)
            </label>
            <input
              type="number"
              value={cash}
              onChange={e => setCash(e.target.value)}
              style={{
                width: '100%', padding: '8px 12px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: 14,
              }}
            />
          </div>
          <button className="btn btn-primary" onClick={handlePortfolioUpdate}>
            Update Portfolio
          </button>
        </div>

        <div className="card">
          <h3 className="card-title" style={{ marginBottom: 16 }}>Watchlist</h3>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 13, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
              Symbols (comma-separated)
            </label>
            <textarea
              value={watchlistText}
              onChange={e => setWatchlistText(e.target.value)}
              rows={6}
              style={{
                width: '100%', padding: '8px 12px',
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)', fontSize: 13, resize: 'vertical',
              }}
            />
          </div>
          <button className="btn btn-primary" onClick={handleWatchlistUpdate}>
            Update Watchlist
          </button>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h3 className="card-title" style={{ marginBottom: 12 }}>Trading Parameters</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
          {[
            ['Max Position Size', '10% of portfolio'],
            ['Max Total Exposure', '80% of portfolio'],
            ['Stop Loss', '7% below entry'],
            ['Take Profit', '15% above entry'],
            ['Min Signal Confidence', '60%'],
            ['Risk per Trade', '2% of portfolio'],
            ['Analysis Weights', 'Tech: 45% | News: 35% | Fund: 20%'],
            ['Lookback Period', '90 days historical'],
            ['News Lookback', '48 hours'],
          ].map(([label, value], i) => (
            <div key={i}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</div>
              <div className="mono" style={{ fontSize: 14, marginTop: 2 }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="disclaimer">
        <strong>DISCLAIMER:</strong> This tool provides analysis and recommendations based on
        technical indicators and news sentiment. It is NOT financial advice. All trading decisions
        are your own. Past performance does not guarantee future results. Always do your own
        research and consider consulting a licensed financial advisor before making investment
        decisions. Trade at your own risk.
      </div>
    </div>
  )
}
