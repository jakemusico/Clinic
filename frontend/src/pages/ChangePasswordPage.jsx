import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../api/auth'
import { ROLE_ROUTES } from '../components/RouteGuards'

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

function pwRules(pw) {
  return {
    length:  pw.length >= 8,
    upper:   /[A-Z]/.test(pw),
    lower:   /[a-z]/.test(pw),
    digit:   /[0-9]/.test(pw),
    special: /[@#$!%*?&]/.test(pw),
  }
}

function allValid(pw) {
  return Object.values(pwRules(pw)).every(Boolean)
}

export default function ChangePasswordPage() {
  const { user, updateUser, logout } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState({
    current_password:      '',
    password:              '',
    password_confirmation: '',
  })
  const [show, setShow] = useState({ current: false, new: false, confirm: false })
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  const rules = pwRules(form.password)

  const RuleLine = ({ ok, label }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: ok ? 'var(--success, #22c55e)' : 'var(--text-muted)' }}>
      {ok
        ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/></svg>
      }
      <span style={{ fontSize: '0.72rem' }}>{label}</span>
    </div>
  )

  const handleChange = (field, val) => {
    setForm(prev => ({ ...prev, [field]: val }))
    setErrors(prev => ({ ...prev, [field]: '' }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const errs = {}

    if (!form.current_password) errs.current_password = 'Required.'
    if (!allValid(form.password)) errs.password = 'Password does not meet all requirements.'
    if (form.password !== form.password_confirmation) errs.password_confirmation = 'Passwords do not match.'

    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }

    setSaving(true)
    try {
      await authApi.changePassword({
        current_password:      form.current_password,
        password:              form.password,
        password_confirmation: form.password_confirmation,
      })
      // Clear the flag in the local user object
      updateUser({ must_change_password: false })
      toast.success('Password changed! Welcome to the system.')
      navigate(ROLE_ROUTES[user?.role] || '/login', { replace: true })
    } catch (err) {
      const d = err?.response?.data
      if (d?.errors) {
        const flat = {}
        Object.entries(d.errors).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? v[0] : v })
        setErrors(flat)
      } else {
        toast.error(d?.message || 'Failed to change password.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '1.5rem',
    }}>
      <div style={{
        background: 'var(--card)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--border)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        width: '100%',
        maxWidth: '420px',
        padding: '2rem',
      }}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '52px',
            height: '52px',
            borderRadius: '50%',
            background: 'rgba(99,102,241,0.12)',
            marginBottom: '0.75rem',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--primary, #6366f1)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text)', margin: '0 0 0.35rem' }}>
            Set Your New Password
          </h1>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-sub)', margin: 0 }}>
            Your account requires you to change your temporary password before continuing.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* Current (temporary) password */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">Temporary Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="cp-current"
                type={show.current ? 'text' : 'password'}
                className={`form-input${errors.current_password ? ' input-error' : ''}`}
                style={{ paddingRight: '2.5rem' }}
                placeholder="Enter the password you received"
                value={form.current_password}
                onChange={e => handleChange('current_password', e.target.value)}
                autoComplete="current-password"
                onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
              />
              <button type="button" onClick={() => setShow(s => ({ ...s, current: !s.current }))}
                style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: 0, lineHeight: 1 }}>
                <EyeIcon open={show.current} />
              </button>
            </div>
            {errors.current_password && <span className="field-error">{errors.current_password}</span>}
          </div>

          {/* New password */}
          <div className="form-group" style={{ marginBottom: '1rem' }}>
            <label className="form-label">New Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="cp-new"
                type={show.new ? 'text' : 'password'}
                className={`form-input${errors.password ? ' input-error' : ''}`}
                style={{ paddingRight: '2.5rem' }}
                placeholder="Create a strong new password"
                value={form.password}
                onChange={e => handleChange('password', e.target.value)}
                autoComplete="new-password"
                onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
              />
              <button type="button" onClick={() => setShow(s => ({ ...s, new: !s.new }))}
                style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: 0, lineHeight: 1 }}>
                <EyeIcon open={show.new} />
              </button>
            </div>
            {errors.password && <span className="field-error">{errors.password}</span>}
            {form.password && (
              <div className="pw-rule-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.5rem' }}>
                <RuleLine ok={rules.length}  label="At least 8 characters" />
                <RuleLine ok={rules.upper}   label="Uppercase letter" />
                <RuleLine ok={rules.lower}   label="Lowercase letter" />
                <RuleLine ok={rules.digit}   label="Number" />
                <RuleLine ok={rules.special} label="Special character (@#$!%*?&)" />
              </div>
            )}
          </div>

          {/* Confirm */}
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">Confirm New Password *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="cp-confirm"
                type={show.confirm ? 'text' : 'password'}
                className={`form-input${errors.password_confirmation ? ' input-error' : ''}`}
                style={{ paddingRight: '2.5rem' }}
                placeholder="Re-enter your new password"
                value={form.password_confirmation}
                onChange={e => handleChange('password_confirmation', e.target.value)}
                autoComplete="new-password"
                onFocus={e => e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })}
              />
              <button type="button" onClick={() => setShow(s => ({ ...s, confirm: !s.confirm }))}
                style={{ position: 'absolute', right: '0.65rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)', padding: 0, lineHeight: 1 }}>
                <EyeIcon open={show.confirm} />
              </button>
            </div>
            {errors.password_confirmation && <span className="field-error">{errors.password_confirmation}</span>}
          </div>

          <button
            id="btn-change-password"
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ width: '100%', padding: '0.65rem' }}
          >
            {saving ? 'Saving...' : 'Set New Password & Continue'}
          </button>

          <button
            type="button"
            className="btn-ghost"
            style={{ width: '100%', marginTop: '0.75rem', fontSize: '0.85rem' }}
            onClick={logout}
          >
            Sign out and log in as someone else
          </button>
        </form>
      </div>
    </div>
  )
}
