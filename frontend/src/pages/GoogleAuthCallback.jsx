import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { authApi } from '../api/auth'
import { ROLE_ROUTES } from '../components/RouteGuards'
import { getApiErrorMessage } from '../utils/apiError'
import fsuuLogo from '../assets/fsuu_logo.png'

const ROLE_CHOICES = [
  { value: 'student',       label: 'Student' },
  { value: 'faculty_staff', label: 'Faculty / Staff' },
]

const storeSession = (token, user) => {
  localStorage.setItem('auth_token', token)
  localStorage.setItem('auth_user', JSON.stringify(user))
}

/**
 * Landing page for the Google OAuth callback (/auth/google?token=… or ?pending=…).
 * - token: an existing account signed in — store the session and go to its dashboard.
 * - pending: new @urios.edu.ph account — pick Student or Faculty/Staff, then finish
 *   sign-up and go to My Profile to complete it (readiness still applies).
 */
export default function GoogleAuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token   = params.get('token')
  const pending = params.get('pending')
  const roleParam = params.get('role')

  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')

  // Existing-account login: exchange the token for the user payload, then route by role.
  useEffect(() => {
    if (!token) return
    let cancelled = false
    ;(async () => {
      try {
        localStorage.setItem('auth_token', token)
        const { data } = await authApi.me()
        if (cancelled) return
        storeSession(token, data.user)
        const roleKey = data.user?.role || roleParam || 'student'
        navigate(ROLE_ROUTES[roleKey] || '/dashboard/student', { replace: true })
      } catch {
        if (!cancelled) {
          localStorage.removeItem('auth_token')
          setError('Could not finish Google sign-in. Please try again.')
        }
      }
    })()
    return () => { cancelled = true }
  }, [token, navigate, roleParam])

  const finishSignup = async (role) => {
    setBusy(true)
    setError('')
    try {
      const { data } = await authApi.googleComplete({ pending, role })
      storeSession(data.token, data.user)
      toast.success('Account created! Please complete your profile.')
      navigate('/profile', { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create your account. Please try again.'))
      setBusy(false)
    }
  }

  return (
    <div className="login-page-wrapper login-centered">
      <div className="login-card-box" style={{ maxWidth: '440px', textAlign: 'center' }}>
        <img src={fsuuLogo} alt="FSUU Logo" className="login-official-logo" style={{ marginBottom: '0.75rem' }} />

        {token ? (
          <>
            <div className="btn-spinner" style={{ margin: '1.5rem auto' }} />
            <p className="login-subtitle">Signing you in…</p>
          </>
        ) : pending ? (
          <>
            <h2 className="login-title" style={{ marginBottom: '0.35rem' }}>Almost done</h2>
            <p className="login-subtitle" style={{ marginBottom: '1.25rem' }}>
              Choose how you will use the clinic portal.
            </p>
            {error && <span className="field-error" style={{ display: 'block', marginBottom: '0.75rem' }}>{error}</span>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {ROLE_CHOICES.map(r => (
                <button
                  key={r.value}
                  type="button"
                  className="btn-primary btn-full"
                  disabled={busy}
                  onClick={() => finishSignup(r.value)}
                >
                  {busy ? <span className="btn-spinner" /> : `Continue as ${r.label}`}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="login-title" style={{ marginBottom: '0.35rem' }}>Sign-in failed</h2>
            <p className="login-subtitle" style={{ marginBottom: '1.25rem' }}>
              {error || 'This Google link is invalid or has expired.'}
            </p>
            <Link to="/login" className="btn-primary btn-full" style={{ display: 'inline-block', textDecoration: 'none' }}>
              Back to Sign In
            </Link>
          </>
        )}
      </div>
    </div>
  )
}
