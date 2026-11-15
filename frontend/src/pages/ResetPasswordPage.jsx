import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { authApi } from '../api/auth'
import { getApiErrorMessage, getFieldErrors } from '../utils/apiError'
import useSubmitLock from '../hooks/useSubmitLock'
import PasswordStrength, { checkPasswordRules } from '../components/PasswordStrength'
import fsuuLogo from '../assets/fsuu_logo.png'
import fsuuBuilding from '../assets/fsuu_building.jpg'

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  )
}

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''
  const email = searchParams.get('email') || ''
  const linkValid = Boolean(token && email)

  const [form, setForm] = useState({ password: '', password_confirmation: '' })
  const [show, setShow] = useState({ new: false, confirm: false })
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const { lock, unlock } = useSubmitLock()

  const handleChange = (field, val) => {
    setForm((prev) => ({ ...prev, [field]: val }))
    setErrors((prev) => ({ ...prev, [field]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = {}
    if (!checkPasswordRules(form.password)) errs.password = 'Password does not meet all requirements.'
    if (form.password !== form.password_confirmation) errs.password_confirmation = 'Passwords do not match.'
    if (Object.keys(errs).length) { setErrors(errs); return }
    if (!lock()) return
    setLoading(true)
    try {
      await authApi.resetPassword({ token, email, ...form })
      setDone(true)
      toast.success('Password reset successfully!')
      setTimeout(() => navigate('/login', { replace: true }), 2000)
    } catch (err) {
      const fieldErrors = getFieldErrors(err)
      if (Object.keys(fieldErrors).length) {
        setErrors(fieldErrors)
      } else {
        toast.error(getApiErrorMessage(err, 'Failed to reset password. The link may have expired.'))
      }
    } finally {
      setLoading(false)
      unlock()
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
            {linkValid
              ? `Set a new password for ${email}`
              : 'This reset link is invalid or incomplete'}
          </p>
        </div>

        {!linkValid ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <p className="field-error" style={{ marginBottom: '1rem' }}>
              This password reset link is missing its token or email. Please request a new reset link.
            </p>
            <Link to="/forgot-password" className="btn-primary btn-full" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
              Request New Link
            </Link>
            <p className="auth-footer" style={{ marginTop: '1.25rem' }}>
              <Link to="/login" className="auth-link">Back to Login</Link>
            </p>
          </div>
        ) : done ? (
          <div style={{ width: '100%', textAlign: 'center' }}>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-sub, #64748B)', marginBottom: '1.25rem' }}>
              Your password has been reset. Redirecting you to login…
            </p>
            <Link to="/login" className="btn-primary btn-full" style={{ display: 'block', textDecoration: 'none', textAlign: 'center' }}>
              Go to Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" style={{ width: '100%' }} noValidate>
            <div className="form-group">
              <label htmlFor="rp-new">New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="rp-new"
                  type={show.new ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  enterKeyHint="next"
                  placeholder="Create a strong password"
                  value={form.password}
                  onChange={(e) => handleChange('password', e.target.value)}
                  className={errors.password ? 'input-error' : ''}
                  style={{ paddingRight: '2.5rem' }}
                  required
                />
                <button type="button" onClick={() => setShow((s) => ({ ...s, new: !s.new }))}
                  style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: 0, lineHeight: 1 }}
                  aria-label={show.new ? 'Hide password' : 'Show password'}>
                  <EyeIcon open={show.new} />
                </button>
              </div>
              {errors.password && <span className="field-error">{errors.password}</span>}
              <PasswordStrength password={form.password} visible={Boolean(form.password)} />
            </div>

            <div className="form-group">
              <label htmlFor="rp-confirm">Confirm New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="rp-confirm"
                  type={show.confirm ? 'text' : 'password'}
                  name="password_confirmation"
                  autoComplete="new-password"
                  enterKeyHint="go"
                  placeholder="Re-enter your new password"
                  value={form.password_confirmation}
                  onChange={(e) => handleChange('password_confirmation', e.target.value)}
                  className={errors.password_confirmation ? 'input-error' : ''}
                  style={{ paddingRight: '2.5rem' }}
                  required
                />
                <button type="button" onClick={() => setShow((s) => ({ ...s, confirm: !s.confirm }))}
                  style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: 0, lineHeight: 1 }}
                  aria-label={show.confirm ? 'Hide password' : 'Show password'}>
                  <EyeIcon open={show.confirm} />
                </button>
              </div>
              {errors.password_confirmation && <span className="field-error">{errors.password_confirmation}</span>}
            </div>

            <button type="submit" className="btn-primary btn-full" disabled={loading}>
              {loading ? <span className="btn-spinner" /> : 'Reset Password'}
            </button>

            <p className="auth-footer" style={{ marginTop: '1.5rem' }}>
              <Link to="/login" className="auth-link">Back to Login</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  )
}
