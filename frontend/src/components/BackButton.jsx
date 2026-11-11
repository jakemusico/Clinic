import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Shared "Back" button for detail pages (e.g. People profiles).
 * Goes back in history; when the page was opened directly (no in-app history),
 * falls back to `fallback` (default: the People list).
 */
export default function BackButton({ fallback = '/clinic/people', label = 'Back' }) {
  const navigate = useNavigate()
  const location = useLocation()

  const goBack = () => {
    // React Router marks the first history entry with key 'default' — that means
    // the user landed here directly (link/new tab), so there is nothing to go back to.
    if (location.key !== 'default') navigate(-1)
    else navigate(fallback)
  }

  return (
    <button
      type="button"
      className="btn-secondary"
      onClick={goBack}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
      </svg>
      {label}
    </button>
  )
}
