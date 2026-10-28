import { useState } from 'react'
import { useApi } from './useApi'

// Lista con "Ver más": pide ?limit= uno más de lo que muestra para saber si hay más.
// "Ver más" agranda el limit (no usa offset), así el refresco periódico trae todo lo
// que ya se ve y no se duplican ni se pierden filas si la lista cambia en el medio.
// pick: dónde está la lista en la respuesta (devices/ devuelve {counts, items}).
export function usePagedApi(path, { params, refreshMs, pageSize = 25, pick = (data) => data } = {}) {
  const [shown, setShown] = useState(pageSize)
  // Filtros nuevos: vuelve a la primera página.
  const key = `${path}|${JSON.stringify(params || {})}`
  const [lastKey, setLastKey] = useState(key)
  if (key !== lastKey) {
    setLastKey(key)
    setShown(pageSize)
  }

  const result = useApi(path, { params: { ...params, limit: shown + 1 }, refreshMs })
  const all = result.data ? pick(result.data) : null
  return {
    ...result,
    items: all?.slice(0, shown) ?? null,
    hasMore: (all?.length ?? 0) > shown,
    loadMore: () => setShown((n) => n + pageSize),
  }
}
