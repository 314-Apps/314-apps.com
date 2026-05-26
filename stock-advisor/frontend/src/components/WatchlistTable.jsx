import React, { useState } from 'react'
import { formatCurrency, formatPct, formatLargeNumber } from '../utils/format'

export default function WatchlistTable({ quotes, onSelectSymbol }) {
  const [sortKey, setSortKey] = useState('symbol')
  const [sortDir, setSortDir] = useState('asc')

  if (!quotes || quotes.length === 0) {
    return <div className="loading"><div className="spinner" /> Loading quotes...</div>
  }

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const sorted = [...quotes].sort((a, b) => {
    let va = a[sortKey] ?? 0
    let vb = b[sortKey] ?? 0
    if (typeof va === 'string') va = va.toLowerCase()
    if (typeof vb === 'string') vb = vb.toLowerCase()
    if (va < vb) return sortDir === 'asc' ? -1 : 1
    if (va > vb) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const SortHeader = ({ label, field }) => (
    <th onClick={() => handleSort(field)} style={{ cursor: 'pointer', userSelect: 'none' }}>
      {label} {sortKey === field ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}
    </th>
  )

  return (
    <div className="card" style={{ padding: 0, overflow: 'auto' }}>
      <table>
        <thead>
          <tr>
            <SortHeader label="Symbol" field="symbol" />
            <SortHeader label="Price" field="price" />
            <SortHeader label="Change" field="change_pct" />
            <SortHeader label="Open" field="open_price" />
            <SortHeader label="High" field="high" />
            <SortHeader label="Low" field="low" />
            <SortHeader label="Volume" field="volume" />
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((q) => (
            <tr key={q.symbol}>
              <td>
                <span className="mono" style={{ fontWeight: 600 }}>{q.symbol}</span>
              </td>
              <td className="mono">{formatCurrency(q.price)}</td>
              <td>
                <span className={`mono ${q.change_pct >= 0 ? 'positive' : 'negative'}`}>
                  {formatPct(q.change_pct)}
                </span>
              </td>
              <td className="mono">{formatCurrency(q.open_price)}</td>
              <td className="mono">{formatCurrency(q.high)}</td>
              <td className="mono">{formatCurrency(q.low)}</td>
              <td className="mono">{q.volume?.toLocaleString() || '—'}</td>
              <td>
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => onSelectSymbol(q.symbol)}
                >
                  Analyze
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
