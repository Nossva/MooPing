import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setForbiddenHandler, setToken, setUnauthorizedHandler } from './client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [token, setTokenState] = useState(getToken)
  const [me, setMe] = useState(null)

  const logout = useCallback(async () => {
    try {
      if (getToken()) await api('auth/logout/', { method: 'POST' })
    } catch {
      // el token ya no sirve: igual cerramos sesión
    }
    setToken(null)
    setTokenState(null)
    setMe(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      setTokenState(null)
      setMe(null)
    })
  }, [])

  const refreshMe = useCallback(() => api('me/').then(setMe).catch(() => {}), [])

  useEffect(() => {
    if (!token) return
    refreshMe()
  }, [token, refreshMe])

  // Si me/ falló (p. ej. el backend se estaba reiniciando), reintentar: sin `me`
  // no sabemos el rol y el dueño no vería "Admin".
  useEffect(() => {
    if (!token || me) return
    const id = setInterval(refreshMe, 5000)
    return () => clearInterval(id)
  }, [token, me, refreshMe])

  useEffect(() => {
    setForbiddenHandler(refreshMe)
  }, [refreshMe])

  const login = useCallback(async (email, password) => {
    const result = await api('auth/login/', { method: 'POST', body: { email, password } })
    setToken(result.token)
    setTokenState(result.token)
    setMe({ user: result.user, organizations: result.organizations })
  }, [])

  // Rol en el establecimiento activo: el primero, igual que el backend sin X-Organization-Id.
  const role = me?.organizations?.[0]?.role ?? null
  const isOwner = role === 'owner'
  // me/ solo lista los establecimientos con acceso activo: vacío = suspendido o sin establecimiento.
  const hasAccess = !me || me.organizations.length > 0

  return (
    <AuthContext value={{ token, me, role, isOwner, hasAccess, login, logout, refreshMe }}>{children}</AuthContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
