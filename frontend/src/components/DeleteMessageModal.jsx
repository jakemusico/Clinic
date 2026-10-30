import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function DeleteMessageModal({
  isOpen,
  onClose,
  onConfirm,
  isDeleting = false,
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && !isDeleting) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isDeleting, onClose])

  if (!isOpen) return null

  return createPortal(
    <div
      className="modal-overlay"
      style={{ zIndex: 100000 }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isDeleting) {
          onClose()
        }
      }}
    >
      <div
        className="modal-card modal-sm"
        style={{ maxWidth: '400px' }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-message-dialog-title"
      >
        <div className="modal-header">
          <h2 id="delete-message-dialog-title">Delete message?</h2>
          <button
            type="button"
            className="modal-close"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p className="confirm-text" style={{ margin: 0 }}>
            This message will be removed for everyone in this chat.
          </p>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
            style={{
              minWidth: '80px',
              opacity: isDeleting ? 0.65 : 1,
              cursor: isDeleting ? 'not-allowed' : 'pointer',
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
