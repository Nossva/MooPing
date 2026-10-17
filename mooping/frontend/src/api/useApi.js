import { useCallback, useEffect, useState } from 'react'
import { api } from './client'

// GET con estado de carga/error y refresco periódico opcional.
export function useApi(path, { params, refreshMs } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  const query = JSON.stringify(params || {})

  const load = useCallback(async () => {
    if (!path) return
    try {
      setData(await api(path, { params: JSON.parse(query) }))
      setError(null)
    } catch (err) {
      setError(err)
    } finally {
      setLoading(false)
    }
  }, [path, query])

  useEffect(() => {
    // fetch: los setState ocurren después del await, no en el cuerpo del efecto
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
    if (!refreshMs) return
    const id = setInterval(load, refreshMs)
    return () => clearInterval(id)
  }, [load, refreshMs])

  return { data, error, loading, reload: load }
}
