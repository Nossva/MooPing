import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './client'

// GET con estado de carga/error y refresco periódico opcional.
// current: false mientras se muestran datos de otros params (ej. al cambiar un filtro).
export function useApi(path, { params, refreshMs } = {}) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(true)
  // Cuándo llegó el último dato bueno: si un refresco falla, data queda con lo anterior.
  const [updatedAt, setUpdatedAt] = useState(null)
  const [loadedKey, setLoadedKey] = useState(null)
  const query = JSON.stringify(params || {})
  const key = `${path}|${query}`
  const latestKey = useRef(key)

  const load = useCallback(async () => {
    if (!path) return
    const requested = `${path}|${query}`
    latestKey.current = requested
    try {
      const result = await api(path, { params: JSON.parse(query) })
      // Una respuesta lenta de un filtro anterior no pisa la del filtro actual.
      if (latestKey.current !== requested) return
      setData(result)
      setLoadedKey(requested)
      setUpdatedAt(Date.now())
      setError(null)
    } catch (err) {
      if (latestKey.current !== requested) return
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

  return { data, error, loading, updatedAt, current: loadedKey === key, reload: load }
}
