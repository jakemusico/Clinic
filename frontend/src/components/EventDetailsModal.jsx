import React from 'react'
import { formatDate } from '../utils/dateUtils'

export function extractEventDetails(notif) {
  if (!notif) return { dateTimeStr: '', isAllDay: false, audience: 'All', postedBy: 'University Clinic' }

  const msg = notif.message || ''
  let dateTimeStr = ''
  let isAllDay = false
  let audience = notif.audience || 'All'
  let postedBy = 'University Clinic Administration'

  // 1. Look for explicit pattern: "Scheduled on Nov 5, 2026 to Nov 6, 2026, 9:00 AM – 4:00 PM."
  const scheduledMatch = msg.match(/(?:Scheduled on|scheduled for|New date:?)\s+([^.]+)/i)
  if (scheduledMatch) {
    dateTimeStr = scheduledMatch[1].trim()
    isAllDay = !dateTimeStr.includes(':') && !dateTimeStr.includes('AM') && !dateTimeStr.includes('PM')
  } else {
    // Look for date pattern like "Oct 21, 2026, 2:56 PM – 7:56 PM" or "Oct 21, 2026"
    const dateMatch = msg.match(/([A-Z][a-z]{2}\s+\d{1,2},\s+\d{4}(?:,\s+\d{1,2}:\d{2}\s+(?:AM|PM)(?:\s*[–-]\s*\d{1,2}:\d{2}\s+(?:AM|PM))?)?)/)
    if (dateMatch) {
      dateTimeStr = dateMatch[1].trim()
      isAllDay = !dateTimeStr.includes(':')
    } else if (notif.created_at) {
      const d = new Date(notif.created_at)
      if (!isNaN(d.getTime())) {
        dateTimeStr = d.toLocaleDateString('en-US', {
          month: 'short', day: 'numeric', year: 'numeric',
          hour: 'numeric', minute: '2-digit', hour12: true
        })
      }
    }
  }

  // Audience detection
  if (msg.toLowerCase().includes('students only')) audience = 'Students'
  else if (msg.toLowerCase().includes('staff only') || msg.toLowerCase().includes('clinic staff')) audience = 'Clinic Staff'
  else if (msg.toLowerCase().includes('faculty')) audience = 'Faculty/Staff'

  return { dateTimeStr, isAllDay, audience, postedBy }
}

export default function EventDetailsModal({ notification, onClose }) {
  if (!notification) return null

  const { dateTimeStr, audience, postedBy } = extractEventDetails(notification)

  return (
    <div
      className="modal-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-card" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <span className="status-badge role-blue" style={{ fontSize: '0.72rem', padding: '0.15rem 0.5rem' }}>
              {audience}
            </span>
            <h2 style={{ fontSize: '1.1rem', margin: 0, color: 'var(--text)' }}>
              {notification.title}
            </h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', paddingTop: '0.5rem' }}>
          {dateTimeStr && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.65rem 0.85rem',
                background: 'var(--bg-card, #f8fafc)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
                fontSize: '0.85rem',
                fontWeight: 600,
                color: 'var(--accent)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span>{dateTimeStr}</span>
            </div>
          )}

          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.35rem', letterSpacing: '0.5px' }}>
              Message Details
            </div>
            <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {notification.message}
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.75rem', borderTop: '1px solid var(--border)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <div>
              Posted by: <span style={{ fontWeight: 600, color: 'var(--text-sub)' }}>{postedBy}</span>
            </div>
            {notification.created_at && (
              <div>
                {formatDate(notification.created_at)}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer" style={{ marginTop: '0.5rem' }}>
          <button type="button" className="btn-primary" onClick={onClose} style={{ minWidth: '90px' }}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
