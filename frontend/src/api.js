/**
 * API helper — all requests go to /api (proxied by nginx or vite dev server).
 * Auth context is stored in localStorage.
 */

const BASE_URL = import.meta.env.VITE_API_URL || '/api'

function getHeaders(extra = {}) {
  return {
    'X-User-ID':   localStorage.getItem('user_id')  || '',
    'X-User-Role': localStorage.getItem('role')      || '',
    ...extra,
  }
}

export async function apiFetch(path, options = {}) {
  const headers = { ...getHeaders(), ...options.headers }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  return res
}

export async function apiGet(path, params) {
  let url = `${BASE_URL}${path}`
  if (params) {
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(params).filter(([, v]) => v != null))
    ).toString()
    if (qs) url += '?' + qs
  }
  const res = await fetch(url, { headers: getHeaders() })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getHeaders() },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function apiPostForm(path, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function apiPutForm(path, formData) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function apiDelete(path) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'DELETE',
    headers: getHeaders(),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `HTTP ${res.status}`)
  }
  return res.json()
}

// ── Session helpers ──────────────────────────────────────────────────────────

export function getSession() {
  return {
    user_id:       localStorage.getItem('user_id'),
    username:      localStorage.getItem('username'),
    role:          localStorage.getItem('role'),
    profile_image: localStorage.getItem('profile_image') || '/static/ava.jpg',
  }
}

export function setSession(user) {
  localStorage.setItem('user_id',  user.id)
  localStorage.setItem('username', user.username)
  localStorage.setItem('role',     user.role || 'user')
  if (user.profile_image) localStorage.setItem('profile_image', user.profile_image)
}

export function clearSession() {
  localStorage.removeItem('user_id')
  localStorage.removeItem('username')
  localStorage.removeItem('role')
  localStorage.removeItem('profile_image')
}

export function isLoggedIn() {
  return !!localStorage.getItem('user_id')
}

export { BASE_URL }
