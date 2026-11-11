import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { ROLE_ROUTES } from '../components/RouteGuards'
import useSubmitLock from '../hooks/useSubmitLock'
import { getApiErrorMessage, getFieldErrors } from '../utils/apiError'
import GoogleAuthButton from '../components/GoogleAuthButton'
import fsuuLogo from '../assets/fsuu_logo.png'
import fsuuBuilding from '../assets/fsuu_building.jpg'

export default function Login() {
  const { login } = useAuth()
  const navigate   = useNavigate()

  const [form, setForm]       = useState({ email: '', password: '' })
  const [errors, setErrors]   = useState({})
  const [loading, setLoading] = useState(false)
  const { lock, unlock } = useSubmitLock()
  const [searchParams] = useSearchParams()

  // Google callback sends users back here with ?error=… on rejection.
  const googleError = {
    domain:   'Only @urios.edu.ph accounts are allowed.',
    inactive: 'Your account has been deactivated. Please contact the administrator.',
    google:   'Google sign-in failed. Please try again.',
  }[searchParams.get('error')]

  const handleFocusScroll = (e) => {
    e.target.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }))
    setErrors((prev) => ({ ...prev, [e.target.name]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!lock()) return   // a sign-in is already running (double click / second Enter)
    setLoading(true)
    setErrors({})
    try {
      const user = await login(form)
      toast.success(`Welcome back, ${user.name}!`)
      const roleKey = typeof user.role === 'string' ? user.role : (user.role?.slug || user.role_slug || 'student')
      navigate(ROLE_ROUTES[roleKey] || '/dashboard/student', { replace: true })
    } catch (err) {
      const fieldErrors = getFieldErrors(err)
      setErrors(Object.keys(fieldErrors).length
        ? fieldErrors
        : { email: getApiErrorMessage(err, 'Login failed. Please try again.') })
    } finally {
      setLoading(false)
      unlock()
    }
  }

  return (
    <div className="login-page-wrapper login-centered">
      {/* Background image layer with subtle soft blur to smooth resolution */}
      <div
        className="login-bg-layer"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 24, 42, 0.44), rgba(15, 24, 42, 0.44)), url(${fsuuBuilding})`,
        }}
      />

      {/* Foreground sharp white card */}
      <div className="login-card-box">
        {/* Top Header with official FSUU logo seal */}
        <div className="login-logo-header">
          <img
            src={fsuuLogo}
            alt="Fr. Saturnino Urios University Official Seal"
            className="login-official-logo"
          />
          <h1 className="login-app-title">FSUU Clinic</h1>
          <p className="login-app-subtitle">Sign in to your account to continue</p>
        </div>

        {/* Existing Authentication Form */}
        <form onSubmit={handleSubmit} className="auth-form" style={{ width: '100%' }} noValidate>
          <div className="form-group">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@university.edu"
              value={form.email}
              onChange={handleChange}
              onFocus={handleFocusScroll}
              className={errors.email ? 'input-error' : ''}
              required
            />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              name="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={form.password}
              onChange={handleChange}
              onFocus={handleFocusScroll}
              className={errors.password ? 'input-error' : ''}
              required
            />
            {errors.password && <span className="field-error">{errors.password}</span>}
          </div>

          <button
            id="login-submit"
            type="submit"
            className="btn-primary btn-full"
            disabled={loading}
          >
            {loading ? <span className="btn-spinner" /> : 'Sign In'}
          </button>
        </form>

        {googleError && (
          <span className="field-error" style={{ display: 'block', textAlign: 'center', marginBottom: '0.5rem' }}>
            {googleError}
          </span>
        )}
        <GoogleAuthButton divider="top" />

        <p className="auth-footer" style={{ marginTop: '1.5rem' }}>
          Don't have an account?{' '}
          <Link to="/register" className="auth-link">Create one</Link>
        </p>
      </div>
    </div>
  )
}
