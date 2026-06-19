import React, { useState } from 'react'
import { formatCurrency, formatPct } from '../utils/format'
import { apiPost } from '../hooks/useApi'

export default function Positions({ positions, alerts, onRefresh }) {
  const [tradeForm, setTradeForm] = useState({
    symbol: '', direction: 'BUY', shares: '', price: '', notes: ''
  })
  const [tradeResult, setTradeResult] = useState(null)

  const handleTrade = async (e) => {
    e.preventDefault()
    try {
      const endpoint = `/trade/${tradeForm.direction.toLowerCase()}`
      const params = new URLSearchParams({
        symbol: tradeForm.symbol.toUpperCase(),
        shares: tradeForm.shares,
        price: tradeForm.price,
        notes: tradeForm.notes,
      })
      const res = await fetch(`/api${endpoint}?${params}`, { method: 'POST' })
      const data = await res.json()
      if (data.error) {
        setTradeResult({ error: data.detail || data.error })
      } else {
        setTradeResult({ success: data.message })
        setTradeForm({ symbol: '', direction: 'BUY', shares: '', price: '', notes: '' })
        if (onRefresh) onRefresh()
      }
    } catch (err) {
      setTradeResult({ error: err.message })
    }
  }

  return (
    <div>
      {/* Trade Recording Form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <h3 className="card-title" style={{ marginBottom: 12 }}>Record a Trade (executed on Fidelity)</h3>
        <form onSubmit={handleTrade}>
          <div className="input-group">
            <input
              placeholder="Symbol (e.g. AAPL)"
              value={tradeForm.symbol}
              onChange={e => setTradeForm(f => ({ ...f, symbol: e.target.value }))}
              required
              style={{ width: 120 }}
            />
            <select
              value={tradeForm.direction}
              onChange={e => setTradeForm(f => ({ ...f, direction: e.target.value }))}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <input
              type="number"
              placeholder="Shares"
              value={tradeForm.shares}
              onChange={e => setTradeForm(f => ({ ...f, shares: e.target.value }))}
              required
              style={{ width: 100 }}
            />
            <input
              type="number"
              step="0.01"
              placeholder="Price"
              value={tradeForm.price}
              onChange={e => setTradeForm(f => ({ ...f, price: e.target.value }))}
              required
              style={{ width: 120 }}
            />
            <input
              placeholder="Notes (optional)"
              value={tradeForm.notes}
              onChange={e => setTradeForm(f => ({ ...f, notes: e.target.value }))}
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn-primary">Record Trade</button>
          </div>
        </form>
        {tradeResult && (
          <div className={`alert-card ${tradeResult.error ? 'alert-high' : 'alert-medium'}`}>
            {tradeResult.error || tradeResult.success}
          </div>
        )}
      </div>

      {/* Alerts */}
      {alerts && alerts.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 className="section-title">Active Alerts</h3>
          {alerts.map((a, i) => (
            <div key={i} className={`alert-card alert-${a.urgency?.toLowerCase() || 'low'}`}>
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* Current Positions */}
      <div className="card" style={{ padding: 0, overflow: 'auto' }}>
        <div style={{ padding: '16px 16px 0' }}>
          <h3 className="card-title">Open Positions</h3>
        </div>
        {(!positions || positions.length === 0) ? (
          <div className="empty-state">No open positions. Record trades as you execute them on Fidelity.</div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Shares</th>
                <th>Avg Entry</th>
                <th>Current</th>
                <th>P&L</th>
                <th>P&L %</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const pos = typeof p === 'object' ? p : {}
                return (
                  <tr key={i}>
                    <td className="mono" style={{ fontWeight: 600 }}>{pos.symbol}</td>
                    <td className="mono">{pos.shares}</td>
                    <td className="mono">{formatCurrency(pos.avg_entry_price)}</td>
                    <td className="mono">{formatCurrency(pos.current_price)}</td>
                    <td className={`mono ${(pos.unrealized_pnl || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {formatCurrency(pos.unrealized_pnl)}
                    </td>
                    <td className={`mono ${(pos.unrealized_pnl_pct || 0) >= 0 ? 'positive' : 'negative'}`}>
                      {formatPct(pos.unrealized_pnl_pct)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
