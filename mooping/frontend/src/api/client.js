// Cliente de la API de MooPing (ver mooping/backend/ENDPOINTS.md).
// En dev Vite proxyea /api a http://localhost:8000.

// La sesión viaja en una cookie HttpOnly que pone el backend al loguearse: JS no la ve,
// así que un XSS no puede robarla. El fetch la manda solo (misma origen).
const BASE = import.meta.env.VITE_API_URL || '/api'

// Versiones anteriores guardaban el token en localStorage: lo borramos.
try {
  localStorage.removeItem('mooping.token')
} catch {
  // sin storage: nada que limpiar
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

// 403: puede ser que el dueño nos haya suspendido el acceso; auth.jsx vuelve a pedir me/.
let onForbidden = () => {}
export function setForbiddenHandler(fn) {
  onForbidden = fn
}

export async function api(path, { method = 'GET', body, params } = {}) {
  const url = new URL(`${BASE}/${path}`, window.location.origin)
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v)
    }
  }
  // X-Requested-With: el backend lo exige en las escrituras (protección CSRF de la cookie).
  const headers = { Accept: 'application/json', 'X-Requested-With': 'MooPing' }
  // FormData (archivos): el navegador pone el Content-Type multipart con su boundary.
  const isForm = body instanceof FormData
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined || isForm ? body : JSON.stringify(body),
  })
  if (res.status === 204) return null
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status === 401) onUnauthorized()
    if (res.status === 403) onForbidden()
    throw new ApiError(res.status, data)
  }
  return data
}
