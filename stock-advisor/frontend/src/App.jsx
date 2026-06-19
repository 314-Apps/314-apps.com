import React, { useState, useCallback } from 'react'
import { useApi, apiGet } from './hooks/useApi'
import PortfolioSummary from './components/PortfolioSummary'
import Recommendations from './components/Recommendations'
import WatchlistTable from './components/WatchlistTable'
import SignalsView from './components/SignalsView'
import StockDetail from './components/StockDetail'
import NewsFeed from './components/NewsFeed'
import Positions from './components/Positions'
import SettingsPanel from './components/SettingsPanel'
import { formatTime } from './utils/format'

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'signals', label: 'Signals' },
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'positions', label: 'Positions' },
  { id: 'news', label: 'News' },
  { id: 'settings', label: 'Settings' },
]

export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [selectedSymbol, setSelectedSymbol] = useState(null)

  const { data: dashData, loading: dashLoading, refetch: refetchDash } =
    useApi('/dashboard', { refreshInterval: 60000 })

  const [signals, setSignals] = useState(null)
  const [signalsLoading, setSignalsLoading] = useState(false)
  const [recs, setRecs] = useState(null)
  const [recsLoading, setRecsLoading] = useState(false)

  const scanSignals = useCallback(async () => {
    setSignalsLoading(true)
    try {
      const data = await apiGet('/signals')
      setSignals(data)
    } catch (err) {
      console.error('Signal scan failed:', err)
    } finally {
      setSignalsLoading(false)
    }
  }, [])

  const fetchRecs = useCallback(async () => {
    setRecsLoading(true)
    try {
      const data = await apiGet('/recommendations')
      setRecs(data)
    } catch (err) {
      console.error('Recommendations failed:', err)
    } finally {
      setRecsLoading(false)
    }
  }, [])

  const handleSelectSymbol = (symbol) => {
    setSelectedSymbol(symbol)
  }

  if (selectedSymbol) {
    return (
      <div className="app">
        <header>
          <h1>Stock Trading Advisor</h1>
          <div className="status">
            <div className="dot" />
            Analyzing {selectedSymbol}
          </div>
        </header>
        <StockDetail
          symbol={selectedSymbol}
          onBack={() => setSelectedSymbol(null)}
        />
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Stock Trading Advisor</h1>
        <div className="status">
          <div className="dot" />
          {dashData?.last_updated
            ? `Updated ${formatTime(dashData.last_updated)}`
            : 'Connecting...'}
        </div>
      </header>

      <div className="nav-tabs">
        {TABS.map(t => (
          <button
            key={t.id}
            className={`nav-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'dashboard' && (
        <div>
          <PortfolioSummary portfolio={dashData?.portfolio} />

          {dashData?.alerts && dashData.alerts.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <h3 className="section-title">Alerts</h3>
              {dashData.alerts.map((a, i) => (
                <div key={i} className={`alert-card alert-${a.urgency?.toLowerCase()}`}>
                  {a.message}
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
            <button className="btn btn-primary" onClick={scanSignals}>
              Scan for Signals
            </button>
            <button className="btn btn-primary" onClick={fetchRecs}>
              Get Recommendations
            </button>
            <button className="btn" onClick={refetchDash}>
              Refresh Data
            </button>
          </div>

          {recs && recs.recommendations && recs.recommendations.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <Recommendations recommendations={recs.recommendations} loading={recsLoading} />
            </div>
          )}

          <WatchlistTable
            quotes={dashData?.watchlist_quotes}
            onSelectSymbol={handleSelectSymbol}
          />

          <div style={{ marginTop: 20 }}>
            <NewsFeed news={dashData?.recent_news?.slice(0, 10)} loading={dashLoading} />
          </div>

          <div className="disclaimer">
            <strong>DISCLAIMER:</strong> This tool provides analysis and recommendations based on
            technical indicators and news sentiment. It is NOT financial advice. All trading
            decisions are yours alone. Past performance does not guarantee future results.
          </div>
        </div>
      )}

      {tab === 'signals' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={scanSignals} disabled={signalsLoading}>
              {signalsLoading ? 'Scanning...' : 'Scan Watchlist'}
            </button>
          </div>
          <SignalsView
            signals={signals}
            loading={signalsLoading}
            onSelectSymbol={handleSelectSymbol}
          />
        </div>
      )}

      {tab === 'recommendations' && (
        <div>
          <div style={{ marginBottom: 16 }}>
            <button className="btn btn-primary" onClick={fetchRecs} disabled={recsLoading}>
              {recsLoading ? 'Generating...' : 'Generate Recommendations'}
            </button>
          </div>
          <Recommendations
            recommendations={recs?.recommendations}
            loading={recsLoading}
          />
        </div>
      )}

      {tab === 'positions' && (
        <Positions
          positions={dashData?.portfolio?.positions}
          alerts={dashData?.alerts}
          onRefresh={refetchDash}
        />
      )}

      {tab === 'news' && (
        <NewsFeed news={dashData?.recent_news} loading={dashLoading} />
      )}

      {tab === 'settings' && (
        <SettingsPanel />
      )}
    </div>
  )
}
