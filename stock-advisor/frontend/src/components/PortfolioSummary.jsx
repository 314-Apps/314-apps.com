import React from 'react'
import { formatCurrency, formatPct } from '../utils/format'

export default function PortfolioSummary({ portfolio }) {
  if (!portfolio) return null

  const stats = [
    {
      label: 'Total Value',
      value: formatCurrency(portfolio.total_value),
      color: null,
    },
    {
      label: 'Cash Available',
      value: formatCurrency(portfolio.cash),
      color: null,
    },
    {
      label: 'Invested',
      value: formatCurrency(portfolio.invested),
      color: null,
    },
    {
      label: 'Unrealized P&L',
      value: formatCurrency(portfolio.unrealized_pnl),
      color: portfolio.unrealized_pnl >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Realized P&L',
      value: formatCurrency(portfolio.realized_pnl),
      color: portfolio.realized_pnl >= 0 ? 'positive' : 'negative',
    },
    {
      label: 'Win Rate',
      value: `${portfolio.win_rate || 0}%`,
      sub: `${portfolio.winning_trades}W / ${portfolio.losing_trades}L`,
      color: (portfolio.win_rate || 0) >= 50 ? 'positive' : 'negative',
    },
  ]

  return (
    <div className="grid grid-3" style={{ marginBottom: 20 }}>
      {stats.map((s, i) => (
        <div className="card" key={i}>
          <div className="card-title">{s.label}</div>
          <div className={`stat-value ${s.color || ''}`} style={{ marginTop: 8 }}>
            {s.value}
          </div>
          {s.sub && <div className="stat-label">{s.sub}</div>}
        </div>
      ))}
    </div>
  )
}
