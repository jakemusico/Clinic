import axios from 'axios'
import { clearAllConsultationDrafts } from '../hooks/useConsultationDraft'

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  withCredentials: true,
  // A request that gets no answer fails after 15 s (shown as "cannot reach the server") instead of
  // leaving a spinner and a disabled Save button for ever.
  timeout: 15000,
})

// Calls that sign a user in or out. A 401 there is the answer to that call (wrong credentials, a
// token that is already gone), not an expired session, so it must not trigger the session-expired redirect.
const AUTH_CALLS = ['/auth/login', '/auth/register', '/auth/logout']
const isAuthCall = (config) => {
  const url = config?.url || ''
  return AUTH_CALLS.some((path) => url === path || url.startsWith(`${path}?`))
}

// Pages that are meant to be open without a session
const PUBLIC_PATHS = ['/login', '/register']

// Attach token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Global response error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !isAuthCall(error.config)) {
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      clearAllConsultationDrafts()   // unfinished consultation drafts hold patient details

      // Already on a public page (e.g. /login): nothing to leave, and a reload would wipe the form
      if (!PUBLIC_PATHS.includes(window.location.pathname)) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
