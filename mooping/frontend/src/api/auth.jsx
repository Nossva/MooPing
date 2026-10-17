import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { api, getToken, setToken, setUnauthorizedHandler } from './client'

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

  useEffect(() => {
    if (!token) return
    api('me/').then(setMe).catch(() => {})
  }, [token])

  const login = useCallback(async (email, password) => {
    const result = await api('auth/login/', { method: 'POST', body: { email, password } })
    setToken(result.token)
    setTokenState(result.token)
    setMe({ user: result.user, organizations: result.organizations })
  }, [])

  return <AuthContext value={{ token, me, login, logout }}>{children}</AuthContext>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  return useContext(AuthContext)
}
