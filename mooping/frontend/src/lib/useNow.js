import { useEffect, useState } from 'react'

// Re-renderiza cada `ms` para que "hace X" avance solo.
export function useNow(ms) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
