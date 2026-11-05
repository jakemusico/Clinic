/**
 * The frame shared by the Nurse (medical) and Dentist (dental) consultation forms:
 * header, the "restore your draft" offer, the scrolling body and the bottom bar with
 * Cancel / Save that is always visible.
 *
 * `inline` renders it as a page card (its bottom bar sticks to the bottom of the page);
 * otherwise it is a modal (the body scrolls, the bottom bar stays at the bottom of the modal).
 */
export default function ConsultationFormFrame({
  title, inline = false, onClose, onSubmit, saving = false, saveLabel,
  draft, onRestoreDraft, onDiscardDraft, children,
}) {
  const savedAt = draft?.savedAt ? new Date(draft.savedAt) : null
  const savedText = savedAt
    ? savedAt.toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
    : ''

  const card = (
    <div className="consult-shell">
      <div className="consult-head">
        <h2>{title}</h2>
        <button
          type="button"
          className={inline ? 'btn-secondary' : 'modal-close'}
          onClick={onClose}
          aria-label={inline ? 'Back to logs' : 'Close'}
        >
          {inline ? 'Back to Logs' : '✕'}
        </button>
      </div>

      {draft && (
        <div className="consult-draft" role="status">
          <span>You have an unsaved draft{savedText ? ` from ${savedText}` : ''}.</span>
          <span className="consult-draft-actions">
            <button type="button" className="btn-primary" onClick={onRestoreDraft}>Restore draft</button>
            <button type="button" className="btn-ghost" onClick={onDiscardDraft}>Discard</button>
          </span>
        </div>
      )}

      <form className="consult-form" onSubmit={onSubmit} noValidate>
        <div className="consult-body">{children}</div>

        <div className="consult-footer">
          <span className="consult-footer-hint"><span className="req-mark">*</span> Required</span>
          <div className="consult-footer-actions">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : saveLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  )

  if (inline) return <div className="consult-inline">{card}</div>

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card consult-modal-card">{card}</div>
    </div>
  )
}
