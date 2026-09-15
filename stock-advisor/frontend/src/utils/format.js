export function formatCurrency(value) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value)
}

export function formatNumber(value, decimals = 2) {
  if (value == null) return '—'
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

export function formatPct(value) {
  if (value == null) return '—'
  const prefix = value > 0 ? '+' : ''
  return `${prefix}${Number(value).toFixed(2)}%`
}

export function formatLargeNumber(value) {
  if (value == null) return '—'
  if (value >= 1e12) return `$${(value / 1e12).toFixed(1)}T`
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  return formatCurrency(value)
}

export function formatTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  const now = new Date()
  const diff = (now - d) / 1000

  if (diff < 60) return 'Just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function signalColor(direction) {
  if (direction === 'BUY') return 'positive'
  if (direction === 'SELL') return 'negative'
  return 'neutral'
}

export function sentimentColor(score) {
  if (score > 0.15) return '#22c55e'
  if (score < -0.15) return '#ef4444'
  return '#94a3b8'
}
