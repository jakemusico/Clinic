import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

/**
 * Dismissible security prompt shown to Google sign-ups (has_password === false).
 * `onAction` should take the user to the Set Password form (profile → account tab).
 * Dismissal lasts for the session; it reappears on the next visit until a
 * password is set, since the account is still missing one.
 */
export default function SetPasswordBanner({ onAction }) {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)

  if (user?.has_password !== false || dismissed) {
    return null
  }

  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '0.85rem',
        flexWrap: 'wrap',
        background: '#FFFBEB',
        border: '1px solid #FDE68A',
        borderRadius: 'var(--radius-sm, 8px)',
        padding: '0.8rem 1rem',
        marginBottom: '1rem',
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B45309" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
        <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
      <div style={{ flex: '1 1 240px', minWidth: 0 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#92400E' }}>Secure your account</div>
        <div style={{ fontSize: '0.8rem', color: '#B45309' }}>
          You signed in with Google. Set a password to also log in with your email address.
        </div>
      </div>
      <button
        type="button"
        className="btn-primary"
        style={{ fontSize: '0.8rem', padding: '0.4rem 0.9rem', flexShrink: 0 }}
        onClick={onAction}
      >
        Set Password
      </button>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#B45309', fontSize: '1.1rem', lineHeight: 1, padding: '0.15rem 0.35rem', flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  )
}
