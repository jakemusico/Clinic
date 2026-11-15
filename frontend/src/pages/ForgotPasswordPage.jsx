import { useState } from 'react'
import { Link } from 'react-router-dom'
import { authApi } from '../api/auth'
import { getApiErrorMessage } from '../utils/apiError'
import fsuuLogo from '../assets/fsuu_logo.png'
import fsuuBuilding from '../assets/fsuu_building.jpg'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.forgotPassword({ email })
      setSent(true)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Something went wrong. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page-wrapper login-centered">
      <div
        className="login-bg-layer"
        style={{
          backgroundImage: `linear-gradient(rgba(15, 24, 42, 0.44), rgba(15, 24, 42, 0.44)), url(${fsuuBuilding})`,
        }}
      />

      <div className="login-card-box">
        <div className="login-logo-header">
          <img
            src={fsuuLogo}
            alt="Fr. Saturnino Urios University Official Seal"
            className="login-official-logo"
          />
          <h1 className="login-app-title">FSUU Clinic</h1>
          <p className="login-app-subtitle">
            {sent ? 'Check your email' : 'Enter your email to receive a reset link'}
          </p>
        </div>

        {sent ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-sub, #64748B)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              If an account with that email exists, a password reset link has been sent.
              Please check your inbox and spam folder. The link expires in 60 minutes.
            </p>
            <Link to="/login" className="btn-primary btn-full" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
              Back to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" style={{ width: '100%' }} noValidate>
            <div className="form-group">
              <label htmlFor="fp-email">Email address</label>
              <input
                id="fp-email"
                type="email"
                name="email"
                autoComplete="email"
                enterKeyHint="go"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && <span className="field-error">{error}</span>}

            <button type="submit" className="btn-primary btn-full" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : 'Send Reset Link'}
            </button>

            <p className="auth-footer" style={{ marginTop: '1.5rem' }}>
              Remembered it? <Link to="/login" className="auth-link">Back to Login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
