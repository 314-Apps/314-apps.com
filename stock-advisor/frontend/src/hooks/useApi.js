import { useState, useEffect, useCallback, useRef } from 'react'

const BASE_URL = '/api'

export function useApi(endpoint, options = {}) {
  const { refreshInterval = 0, autoFetch = true } = options
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const intervalRef = useRef(null)

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const res = await fetch(`${BASE_URL}${endpoint}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      setData(json)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [endpoint])

  useEffect(() => {
    if (autoFetch) {
      fetchData()
    }

    if (refreshInterval > 0) {
      intervalRef.current = setInterval(fetchData, refreshInterval)
      return () => clearInterval(intervalRef.current)
    }
  }, [fetchData, refreshInterval, autoFetch])

  return { data, loading, error, refetch: fetchData }
}

export async function apiPost(endpoint, body = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function apiGet(endpoint) {
  const res = await fetch(`${BASE_URL}${endpoint}`)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}
