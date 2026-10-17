// Cliente de la API de MooPing (ver mooping/backend/ENDPOINTS.md).
// En dev Vite proxyea /api a http://localhost:8000.

const BASE = import.meta.env.VITE_API_URL || '/api'
const TOKEN_KEY = 'mooping.token'

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    // sin storage: la sesión dura lo que la pestaña
  }
}

export class ApiError extends Error {
  constructor(status, body) {
    super(messageFrom(body) || `Error ${status}`)
    this.status = status
    this.body = body
  }
}

function messageFrom(body) {
  if (!body || typeof body !== 'object') return null
  if (body.detail) return body.detail
  const first = Object.values(body)[0]
  return Array.isArray(first) ? first[0] : null
}

let onUnauthorized = () => {}
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn
}

export async function api(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${BASE}/${path}`, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    }
  }
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch(url, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) onUnauthorized()
    throw new ApiError(res.status, data)
  }
  return data
}
