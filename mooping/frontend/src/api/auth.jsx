import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, setForbiddenHandler, setUnauthorizedHandler } from './client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  // La cookie de sesión es HttpOnly: JS no sabe si existe. me/ lo dice
  // (200 = hay sesión, 401 = no). 'checking' hasta la primera respuesta.
  const [session, setSession] = useState('checking') // checking | in | out
  const [me, setMe] = useState(null)

  const signedOut = useCallback(() => {
    setSession('out')
    setMe(null)
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('auth/logout/', { method: 'POST' })
    } catch {
      // la sesión ya no servía: igual cerramos
    }
    signedOut()
  }, [signedOut])

  useEffect(() => {
    setUnauthorizedHandler(signedOut)
  }, [signedOut])

  // Un error que no sea 401 (p. ej. el backend se estaba reiniciando) no cierra la sesión.
  const refreshMe = useCallback(
    () =>
      api('me/')
        .then((data) => {
          setMe(data)
          setSession('in')
        })
        .catch(() => {}),
    [],
  )

  useEffect(() => {
    refreshMe()
  }, [refreshMe])

  // Si me/ falló sin un 401, reintentar: sin `me` no sabemos el rol y el dueño no vería "Admin".
  useEffect(() => {
    if (session === 'out' || me) return
    const id = setInterval(refreshMe, 5000)
    return () => clearInterval(id)
  }, [session, me, refreshMe])

  useEffect(() => {
    setForbiddenHandler(refreshMe)
  }, [refreshMe])

  const login = useCallback(async (email, password) => {
    const result = await api('auth/login/', { method: 'POST', body: { email, password } })
    setMe({ user: result.user, organizations: result.organizations })
    setSession('in')
  }, [])

  // Rol en el establecimiento activo: el primero, igual que el backend sin X-Organization-Id.
  const role = me?.organizations?.[0]?.role ?? null
  const isOwner = role === 'owner'
  // Secciones del menú que puede abrir (el backend ya resuelve "todas" para el dueño).
  const sections = me?.organizations?.[0]?.sections ?? null
  const can = useCallback((section) => isOwner || !sections || sections.includes(section), [isOwner, sections])
  // me/ solo lista los establecimientos con acceso activo: vacío = suspendido o sin establecimiento.
  const hasAccess = !me || me.organizations.length > 0

  return (
    <AuthContext value={{ session, me, role, isOwner, sections, can, hasAccess, login, logout, refreshMe }}>
      {children}
    </AuthContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
