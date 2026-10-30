import { useEffect, useRef } from 'react'

/**
 * ConfirmModal — Replaces window.confirm() throughout the application.
 *
 * Props:
 *   open         {boolean}      — show/hide modal
 *   title        {string}       — modal title/heading
 *   message      {string|node}  — body content / explanation text
 *   confirmLabel {string}       — label for confirm button (default: "Confirm")
 *   cancelLabel  {string}       — label for cancel button (default: "Cancel")
 *   danger       {boolean}      — styled red for destructive actions (default: true)
 *   loading      {boolean}      — disables buttons and displays a spinner while action runs
 *   onConfirm    {function}     — callback invoked on confirm
 *   onCancel     {function}     — callback invoked on cancel, backdrop click, or Escape
 */
export default function ConfirmModal({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}) {
  const cancelBtnRef = useRef(null)

  // Close on Escape key press
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        onCancel?.()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, loading, onCancel])

  // Focus cancel button for keyboard accessibility when opened
  useEffect(() => {
    if (open) {
      cancelBtnRef.current?.focus()
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="modal-overlay"
      style={{ zIndex: 9999 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) {
          onCancel?.()
        }
      }}
    >
      <div
        className="modal-card modal-sm"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        style={{
          maxWidth: '440px',
          width: '95vw',
          margin: 'auto',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="confirm-modal-title" style={{ fontSize: '1.05rem', margin: 0 }}>
            {title}
          </h2>
          <button
            type="button"
            className="modal-close"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="modal-body" style={{ paddingTop: '0.5rem', paddingBottom: '1.25rem' }}>
          {typeof message === 'string' ? (
            <p style={{ margin: 0, fontSize: '0.9rem', color: 'var(--text-sub, #64748B)', lineHeight: 1.55 }}>
              {message}
            </p>
          ) : (
            message
          )}
        </div>

        <div
          className="modal-footer"
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '0.65rem',
            padding: '0.85rem 1.25rem 1.25rem',
            borderTop: '1px solid var(--border, #E2E8F0)',
          }}
        >
          <button
            ref={cancelBtnRef}
            type="button"
            className="btn-secondary"
            onClick={onCancel}
            disabled={loading}
            style={{ minWidth: '85px', minHeight: '38px' }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={danger ? 'btn-danger' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
            style={{
              minWidth: '95px',
              minHeight: '38px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.4rem',
            }}
          >
            {loading ? (
              <>
                <span className="loader-ring" style={{ width: '14px', height: '14px', borderWidth: '2px' }} />
                <span>Loading…</span>
              </>
            ) : (
              confirmLabel
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

