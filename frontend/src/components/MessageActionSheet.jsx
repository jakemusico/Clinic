import { useEffect } from 'react'
import { createPortal } from 'react-dom'

/* ── Inline SVG Icons (no emojis, no arrows) ─────────────────────── */

export function MoreDotsIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
      <circle cx="5" cy="12" r="2" />
    </svg>
  )
}

export function EditIcon({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  )
}

export function TrashIcon({ size = 15 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
  )
}

/* ── Check if message is editable (within 15 minutes) ────────────── */
export function isMessageEditable(message) {
  if (!message || !message.created_at) return false
  const createdMs = new Date(message.created_at).getTime()
  return (Date.now() - createdMs) <= 15 * 60 * 1000
}

/* ── Touch Bottom Sheet Menu (Rendered in Portal) ─────────────────── */

export function MessageActionSheet({ message, onClose, onEdit, onDelete }) {
  useEffect(() => {
    if (!message) return
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [message, onClose])

  if (!message) return null

  const canEdit = isMessageEditable(message)

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(2px)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        padding: 0,
        animation: 'fadeIn 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-surface, #ffffff)',
          borderTop: '1px solid var(--border, #e2e8f0)',
          borderRadius: '16px 16px 0 0',
          padding: '0.85rem 1rem 1.75rem',
          width: '100%',
          maxWidth: '440px',
          boxShadow: '0 -8px 24px rgba(0, 0, 0, 0.15)',
          animation: 'slideUp 0.18s ease-out',
          boxSizing: 'border-box',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Grab bar */}
        <div
          style={{
            width: '36px',
            height: '4px',
            background: 'var(--border, #cbd5e1)',
            borderRadius: '2px',
            margin: '0 auto 0.85rem',
          }}
        />

        {/* Message preview snippet */}
        <div
          style={{
            fontSize: '0.78rem',
            color: 'var(--text-sub, #64748b)',
            padding: '0 0.5rem 0.65rem',
            borderBottom: '1px solid var(--border, #e2e8f0)',
            marginBottom: '0.65rem',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {message.body}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onEdit(message)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                width: '100%',
                minHeight: '48px',
                padding: '0.75rem 1rem',
                background: 'var(--bg, #f8fafc)',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: 'var(--radius-md, 10px)',
                color: 'var(--text, #0f172a)',
                fontSize: '0.95rem',
                fontWeight: 600,
                cursor: 'pointer',
                textAlign: 'left',
                boxSizing: 'border-box',
              }}
            >
              <EditIcon size={16} />
              <span>Edit Message</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose()
              onDelete(message)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              width: '100%',
              minHeight: '48px',
              padding: '0.75rem 1rem',
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: 'var(--radius-md, 10px)',
              color: 'var(--red, #ef4444)',
              fontSize: '0.95rem',
              fontWeight: 600,
              cursor: 'pointer',
              textAlign: 'left',
              boxSizing: 'border-box',
            }}
          >
            <TrashIcon size={16} />
            <span>Delete Message</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            style={{
              marginTop: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              minHeight: '44px',
              padding: '0.65rem 1rem',
              background: 'transparent',
              border: '1px solid var(--border, #e2e8f0)',
              borderRadius: 'var(--radius-md, 10px)',
              color: 'var(--text-sub, #64748b)',
              fontSize: '0.9rem',
              fontWeight: 600,
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

/* ── Desktop Popover / Dropdown Menu (Rendered in Portal) ────────── */

export function DesktopActionMenu({ message, isOpen, onClose, onEdit, onDelete, anchorRect }) {
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      onClose()
    }
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    // Slight delay or immediate window listener
    window.addEventListener('click', handleClickOutside)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', handleClickOutside)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen || !message || !anchorRect) return null

  const canEdit = isMessageEditable(message)

  // Compute fixed position near anchor button
  const menuWidth = 130
  let left = anchorRect.left
  if (left + menuWidth > window.innerWidth - 12) {
    left = window.innerWidth - menuWidth - 12
  }
  if (left < 12) left = 12

  let top = anchorRect.bottom + 4
  const menuHeight = canEdit ? 80 : 44
  if (top + menuHeight > window.innerHeight - 12) {
    top = Math.max(12, anchorRect.top - menuHeight - 4)
  }

  return createPortal(
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: `${top}px`,
        left: `${left}px`,
        background: 'var(--bg-surface, #ffffff)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: 'var(--radius-sm, 8px)',
        boxShadow: '0 6px 20px rgba(0, 0, 0, 0.15)',
        zIndex: 99999,
        minWidth: `${menuWidth}px`,
        overflow: 'hidden',
        animation: 'fadeIn 0.12s ease',
      }}
    >
      {canEdit && (
        <button
          type="button"
          onClick={() => {
            onClose()
            onEdit(message)
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '0.55rem 0.85rem',
            background: 'transparent',
            border: 'none',
            fontSize: '0.82rem',
            fontWeight: 600,
            color: 'var(--text, #0f172a)',
            cursor: 'pointer',
            textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg, #f8fafc)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <EditIcon size={14} />
          <span>Edit</span>
        </button>
      )}

      <button
        type="button"
        onClick={() => {
          onClose()
          onDelete(message)
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          width: '100%',
          padding: '0.55rem 0.85rem',
          background: 'transparent',
          border: 'none',
          borderTop: canEdit ? '1px solid var(--border, #e2e8f0)' : 'none',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: 'var(--red, #ef4444)',
          cursor: 'pointer',
          textAlign: 'left',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        <TrashIcon size={14} />
        <span>Delete</span>
      </button>
    </div>,
    document.body
  )
}
