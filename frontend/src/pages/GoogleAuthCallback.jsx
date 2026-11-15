import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { authApi } from '../api/auth'
import { useAuth } from '../context/AuthContext'
import { ROLE_ROUTES } from '../components/RouteGuards'
import { getApiErrorMessage } from '../utils/apiError'
import fsuuLogo from '../assets/fsuu_logo.png'
import fsuuBuilding from '../assets/fsuu_building.jpg'

const ROLE_CHOICES = [
  { value: 'student',       label: 'Student' },
  { value: 'faculty_staff', label: 'Faculty / Staff' },
]

/**
 * Landing page for the Google OAuth callback (/auth/google?token=… or ?pending=…).
 * - token: an existing account signed in — finish the session through AuthContext
 *   (so route guards see the user) and go to its dashboard.
 * - pending: new @urios.edu.ph account — pick Student or Faculty/Staff, then finish
 *   sign-up and go to My Profile to complete it (readiness still applies).
 */
export default function GoogleAuthCallback() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()
  const processed = useRef(false)

  const token   = params.get('token')
  const pending = params.get('pending')
  const roleParam = params.get('role')

  // Strip the params from the address bar once so the token is not left in
  // history or referrers (the router location is untouched, so params stay
  // readable for this page's lifetime).
  useEffect(() => {
    window.history.replaceState({}, '', '/auth/google')
  }, [])

  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')

  // Existing-account login: finish the session via AuthContext (stores token,
  // re-reads /me, updates user state), then route by role.
  useEffect(() => {
    if (!token || processed.current) return
    processed.current = true
    loginWithToken(token)
      .then((user) => navigate(ROLE_ROUTES[user?.role] || ROLE_ROUTES[roleParam] || '/dashboard/student', { replace: true }))
      .catch(() => navigate('/login?error=google', { replace: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const finishSignup = async (role) => {
    setBusy(true)
    setError('')
    try {
      const { data } = await authApi.googleComplete({ pending, role })
      await loginWithToken(data.token)
      toast.success('Account created! Please complete your profile.')
      navigate('/profile', { replace: true })
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not create your account. Please try again.'))
      setBusy(false)
    }
  }

  const subtitle = token
    ? 'Signing you in with Google…'
    : pending
      ? 'Choose how you will use the clinic portal'
      : 'This sign-in link is invalid or has expired'

  return (
    <div className="login-page-wrapper login-centered">
      <div
        className="login-bg-layer"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 24, 42, 0.44), rgba(15, 24, 42, 0.44)), url(${fsuuBuilding})`,
        }}
      />

      <div className="login-card-box" style={{ maxWidth: '440px', textAlign: 'center' }}>
        <div className="login-logo-header">
          <img
            src={fsuuLogo}
            alt="Fr. Saturnino Urios University Official Seal"
            className="login-official-logo"
          />
          <h1 className="login-app-title">FSUU Clinic</h1>
          <p className="login-app-subtitle">{subtitle}</p>
        </div>

        {token ? (
          <div style={{ width: '100%' }}>
            <div className="btn-spinner" style={{ margin: '1.25rem auto', width: '34px', height: '34px', borderWidth: '3px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-sub, #64748B)', margin: '0.75rem 0 0' }}>
              Please wait while we verify your account.
            </p>
          </div>
        ) : pending ? (
          <div style={{ width: '100%' }}>
            {error && (
              <div className="field-error" style={{
                display: 'block', textAlign: 'left', marginBottom: '1rem',
                background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
                padding: '0.65rem 0.85rem', fontSize: '0.82rem',
              }}>
                {error}
              </div>
            )}
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
          </div>
        ) : (
          <div style={{ width: '100%' }}>
            <div className="field-error" style={{
              display: 'block', textAlign: 'left', marginBottom: '1rem',
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px',
              padding: '0.75rem 0.9rem', fontSize: '0.85rem',
            }}>
              {error || 'This Google link is invalid or has expired. Please try signing in again.'}
            </div>
            <Link to="/login" className="btn-primary btn-full" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
              Back to Login
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
