import { useState } from 'react'
import { authApi } from '../api/auth'
import { getApiErrorMessage } from '../utils/apiError'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.17 3.57-8.81z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.87-3c-1.07.72-2.45 1.15-4.08 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.1A12 12 0 0 0 12 24z" />
      <path fill="#FBBC05" d="M5.27 14.28A7.2 7.2 0 0 1 4.89 12c0-.79.14-1.56.38-2.28v-3.1H1.28a12 12 0 0 0 0 10.76l3.99-3.1z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.6 4.58 1.8l3.44-3.44A11.97 11.97 0 0 0 12 0 12 12 0 0 0 1.28 6.62l3.99 3.1C6.22 6.88 8.87 4.77 12 4.77z" />
    </svg>
  )
}

function OrDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', margin: '1rem 0', color: 'var(--text-muted, #64748B)', fontSize: '0.8rem' }}>
      <span style={{ flex: 1, height: '1px', background: 'var(--border, #E2E8F0)' }} />
      or
      <span style={{ flex: 1, height: '1px', background: 'var(--border, #E2E8F0)' }} />
    </div>
  )
}

/**
 * "Continue with Google" button + "or" divider, shared by Login and Register.
 * Sends the browser to Google's consent screen (hd=urios.edu.ph hint); the backend
 * enforces the domain and email_verified on the callback.
 * divider: 'bottom' (default, Register) or 'top' (Login, under the Sign In button).
 */
export default function GoogleAuthButton({ label = 'Continue with Google', divider = 'bottom' }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const start = async () => {
    setLoading(true)
    setError('')
    try {
      const { data } = await authApi.googleRedirect()
      window.location.href = data.url
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not start Google sign-in. Please try again.'))
      setLoading(false)
    }
  }

  return (
    <div style={{ width: '100%' }}>
      {divider === 'top' && <OrDivider />}
      <button
        type="button"
        onClick={start}
        disabled={loading}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
          width: '100%', height: '44px',
          background: '#FFFFFF', color: 'var(--text, #0F172A)',
          border: '1px solid var(--border, #E2E8F0)', borderRadius: '10px',
          fontSize: '0.92rem', fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
        }}
      >
        {loading ? <span className="btn-spinner" /> : <GoogleIcon />}
        {loading ? 'Redirecting…' : label}
      </button>
      {error && <span className="field-error" style={{ display: 'block', marginTop: '0.4rem', textAlign: 'center' }}>{error}</span>}
      {divider === 'bottom' && <OrDivider />}
    </div>
  )
}
