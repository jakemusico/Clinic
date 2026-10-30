import { useRef, useEffect, useState, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import {
  MessageActionSheet,
  DesktopActionMenu,
  MoreDotsIcon,
} from './MessageActionSheet'
import DeleteMessageModal from './DeleteMessageModal'
import { useNavigate, useLocation } from 'react-router-dom'
import { chatbotApi } from '../api/chatbot'
import { chatApi } from '../api/chat'
import { adminApi } from '../api/admin'
import { useChatbot } from '../context/ChatbotContext'
import { useAuth } from '../context/AuthContext'

/* ─────────────────────────────────────────────────────────────────────────
   CATEGORY → NAVIGATION ACTIONS
   ───────────────────────────────────────────────────────────────────────── */
const NAV_ACTIONS = {
  appointments: {
    patient: [
      { label: 'Book Appointment',  path: '/appointments?tab=book', icon: 'calendar-plus' },
      { label: 'My Appointments',   path: '/appointments',           icon: 'calendar' },
    ],
    staff:   [{ label: 'Manage Appointments', path: '/clinic/appointments', icon: 'calendar' }],
    dental:  [{ label: 'Dental Appointments', path: '/dental/appointments', icon: 'calendar' }],
    admin:   [{ label: 'Appointments',        path: '/clinic/appointments', icon: 'calendar' }],
  },
  dental: {
    patient: [
      { label: 'Book Dental Appointment', path: '/appointments?tab=book&type=dental', icon: 'calendar-plus' },
      { label: 'My Dental Records',       path: '/my-records?tab=dental',             icon: 'file' },
    ],
    staff:   [],
    dental:  [
      { label: 'Dental Consultations', path: '/dental/consultations', icon: 'file' },
      { label: 'Dental Chart',         path: '/dental/chart',         icon: 'grid' },
    ],
    admin:   [{ label: 'Dental Consultations', path: '/dental/consultations', icon: 'file' }],
  },
  records: {
    patient: [{ label: 'My Health Records', path: '/my-records',    icon: 'file' }],
    staff:   [{ label: 'Patient Directory',  path: '/clinic/people', icon: 'file' }],
    dental:  [{ label: 'Patient Directory',  path: '/clinic/people', icon: 'file' }],
    admin:   [{ label: 'Medical Records',    path: '/clinic/records',icon: 'file' }],
  },
  services: {
    patient: [{ label: 'Book Appointment', path: '/appointments?tab=book', icon: 'calendar-plus' }],
    staff:   [{ label: 'Clinic Services',  path: '/clinic/services',       icon: 'grid' }],
    dental:  [{ label: 'Dental Services',  path: '/clinic/services',       icon: 'grid' }],
    admin:   [{ label: 'Clinic Services',  path: '/clinic/services',       icon: 'grid' }],
  },
  emergency: {
    patient: [{ label: 'Notifications', path: '/notifications', icon: 'bell' }],
    staff:   [],
    dental:  [],
    admin:   [],
  },
  hours:        { patient: [], staff: [], dental: [], admin: [] },
  requirements: { patient: [], staff: [], dental: [], admin: [] },
  general:      { patient: [], staff: [], dental: [], admin: [] },
}

/* Category → follow-up suggestion chips shown after an FAQ answer */
const SUGGESTIONS = {
  appointments: [
    { label: 'Book Appointment',   value: 'appointments', icon: 'calendar-plus' },
    { label: 'Clinic Services',    value: 'services',     icon: 'grid' },
    { label: 'My Records',         value: 'records',      icon: 'file' },
  ],
  dental: [
    { label: 'Book Dental Visit',  value: 'dental',       icon: 'calendar-plus' },
    { label: 'Dental Services',    value: 'services',     icon: 'grid' },
  ],
  records: [
    { label: 'Appointments',       value: 'appointments', icon: 'calendar' },
    { label: 'Clinic Hours',       value: 'hours',        icon: 'hours' },
  ],
  services: [
    { label: 'Book Appointment',   value: 'appointments', icon: 'calendar-plus' },
    { label: 'Clinic Hours',       value: 'hours',        icon: 'hours' },
  ],
  emergency: [
    { label: 'Clinic Hours',       value: 'hours',        icon: 'hours' },
    { label: 'Services',           value: 'services',     icon: 'grid' },
  ],
  hours: [
    { label: 'Book Appointment',   value: 'appointments', icon: 'calendar-plus' },
    { label: 'Clinic Services',    value: 'services',     icon: 'grid' },
  ],
  requirements: [
    { label: 'Book Appointment',   value: 'appointments', icon: 'calendar-plus' },
    { label: 'My Records',         value: 'records',      icon: 'file' },
  ],
  general: [
    { label: 'Clinic Hours',       value: 'hours',        icon: 'hours' },
    { label: 'Appointments',       value: 'appointments', icon: 'calendar' },
  ],
}

/** Resolve the role-group key for a given user role */
function roleGroup(role) {
  if (role === 'clinic_staff') return 'staff'
  if (role === 'dentist')      return 'dental'
  if (role === 'admin')        return 'admin'
  return 'patient'
}

function getNavActions(category, role) {
  const map = NAV_ACTIONS[category]
  if (!map) return []
  return map[roleGroup(role)] || []
}

/**
 * Normalizes a label for deduplication comparison.
 */
function normalizeLabel(text) {
  return (text || '')
    .toLowerCase()
    .replace(/visit/g, 'appointment')
    .replace(/[^a-z0-9]/g, '')
    .replace(/s$/, '')
}

/**
 * Checks if a quick-reply chip duplicates an action button above it.
 */
function isDuplicateSuggestion(chip, navActions = []) {
  if (!navActions || navActions.length === 0 || !chip?.label) return false

  const chipNorm = normalizeLabel(chip.label)
  if (!chipNorm) return false

  return navActions.some(action => {
    const actionNorm = normalizeLabel(action.label)
    if (!actionNorm) return false

    if (chipNorm === actionNorm) return true
    if (chipNorm.length >= 7 && actionNorm.includes(chipNorm)) return true
    if (actionNorm.length >= 7 && chipNorm.includes(actionNorm)) return true

    return false
  })
}

function getSuggestions(category, navActions = []) {
  const list = SUGGESTIONS[category] || []
  return list.filter(chip => !isDuplicateSuggestion(chip, navActions)).slice(0, 3)
}

/* ── Time-of-day greeting ──────────────────────────────────── */
function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

/* ── Inline SVG icons (No emojis, no arrows) ────────────────── */
function SvgIcon({ name, size = 15 }) {
  const paths = {
    health_inquiries: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    clinic_services:  'M22 12h-4l-3 9L9 3l-3 9H2',
    appointment_help: 'M8 2v4M16 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
    clinic_faqs:      'M12 2a10 10 0 100 20 10 10 0 000-20zm0 16h.01M12 14a3 3 0 000-6 3.01 3.01 0 000 6z',
    emergency:        'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z M12 9v4 M12 17h.01',
    general:          'M12 2a10 10 0 100 20 10 10 0 000-20zm0 8h.01M12 12h.01M12 14h.01',
    services:         'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5',
    dental:           'M12 2a4 4 0 00-4 4v2a2 2 0 002 2h4a2 2 0 002-2V6a4 4 0 00-4-4zM6 14a2 2 0 012-2h8a2 2 0 012 2v4a4 4 0 01-4 4h-4a4 4 0 01-4-4v-4z',
    nurse:            'M12 2v20M2 12h20',
    appointments:     'M8 2v4M16 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
    hours:            'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    records:          'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    requirements:     'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
    'calendar-plus':  'M8 2v4M16 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6zM12 15v4M10 17h4',
    calendar:         'M8 2v4M16 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
    file:             'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6',
    grid:             'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
    bell:             'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
    send:             'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    trash:            'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  }
  const d = paths[name] || paths.general
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"
      style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0 }}>
      <path d={d} />
    </svg>
  )
}

/* ── Markdown-lite renderer ──────────────────────────────────── */
function renderText(text) {
  if (!text) return null
  return text.split('\n').map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*)/)
    return (
      <span key={i}>
        {parts.map((p, j) =>
          p.startsWith('**') && p.endsWith('**')
            ? <strong key={j}>{p.slice(2, -2)}</strong>
            : <span key={j}>{p}</span>
        )}
        <br />
      </span>
    )
  })
}

/* ── Timestamp helper ────────────────────────────────────────── */
function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}

/* ── Date separator helper ───────────────────────────────────── */
function getDateLabel(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const msgDate = new Date(d.getFullYear(), d.getMonth(), d.getDate())

  if (msgDate.getTime() === today.getTime()) return 'Today'
  if (msgDate.getTime() === yesterday.getTime()) return 'Yesterday'
  return d.toLocaleDateString('en-PH', { month: 'long', day: 'numeric', year: 'numeric' })
}

/* ── Message bubble ──────────────────────────────────────────── */
function Bubble({ msg, onCategoryChip, onStartChat }) {
  const isBot = msg.from === 'bot'
  const [hovered, setHovered] = useState(false)

  const visibleSuggestions = (msg.suggestions || []).filter(
    s => !isDuplicateSuggestion(s, msg.navActions)
  )

  return (
    <div className={`chat-bubble-row ${isBot ? 'bot' : 'user'} chat-msg-enter`}>
      <div
        className={`chat-bubble ${isBot ? 'bot' : 'user'}`}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {renderText(msg.text)}

        {/* Category / subtopic buttons */}
        {msg.buttons?.length > 0 && (
          <div className="chat-btn-group" style={{ marginTop: '0.75rem' }}>
            {msg.buttons.map(btn => (
              <button
                key={btn.value}
                className="chat-menu-btn"
                onClick={() => msg.onButtonClick?.(btn)}
              >
                <SvgIcon name={btn.value} size={14} />
                <span>{btn.label}</span>
              </button>
            ))}
          </div>
        )}

        {/* Fallback Live Chat Options */}
        {msg.chatButtons && (
          <div className="chat-btn-group" style={{ marginTop: '0.75rem' }}>
            <button
              className="chat-menu-btn"
              onClick={() => onStartChat?.('nurse')}
            >
              <SvgIcon name="nurse" size={14} />
              <span>Chat with Nurse</span>
            </button>
            <button
              className="chat-menu-btn"
              onClick={() => onStartChat?.('dentist')}
            >
              <SvgIcon name="dental" size={14} />
              <span>Chat with Dentist</span>
            </button>
          </div>
        )}

        {/* FAQ question list */}
        {msg.faqs?.length > 0 && (
          <div className="chat-btn-group" style={{ marginTop: '0.6rem' }}>
            {msg.faqs.map(faq => (
              <button
                key={faq.id}
                className="chat-faq-btn"
                onClick={() => msg.onFaqClick?.(faq)}
              >
                <SvgIcon name={faq.category || 'clinic_faqs'} size={13} />
                <span>{faq.question}</span>
              </button>
            ))}
          </div>
        )}

        {/* Nav action buttons */}
        {msg.navActions?.length > 0 && (
          <div style={{ marginTop: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {msg.navActions.map(action => (
              <button
                key={action.path}
                className="chatbot-send-btn"
                onClick={() => action.onClick?.()}
                style={{
                  width: '100%', padding: '0.5rem 0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '6px', fontWeight: 600, fontSize: '0.8rem',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                }}
              >
                <SvgIcon name={action.icon || 'general'} size={13} />
                {action.label}
              </button>
            ))}
          </div>
        )}

        {/* Quick-reply suggestion chips after an answer */}
        {visibleSuggestions.length > 0 && (
          <div className="chat-suggestion-row" style={{ marginTop: '0.75rem' }}>
            {visibleSuggestions.map(s => (
              <button
                key={s.value}
                className="chat-chip"
                onClick={() => onCategoryChip?.(s)}
              >
                <SvgIcon name={s.icon || 'general'} size={12} />
                <span>{s.label}</span>
              </button>
            ))}
          </div>
        )}

        {msg.hint && <p className="chat-hint">{msg.hint}</p>}

        {/* Timestamp */}
        <div className={`chat-timestamp ${hovered ? 'visible' : ''}`}>
          {formatTime(msg.ts)}
        </div>
      </div>
    </div>
  )
}

/* ── Typing indicator ────────────────────────────────────────── */
function TypingIndicator() {
  return (
    <div className="chat-bubble-row bot chat-msg-enter">
      <div className="chat-bubble bot chat-typing">
        <span /><span /><span />
      </div>
    </div>
  )
}

/* ── Date Separator ─────────────────────────────────────────── */
function DateSeparator({ label }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.5rem',
      margin: '0.5rem 0',
    }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
    </div>
  )
}

function generateClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'cid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
}

/* ── Silent Merge Helper (prevents re-render if unchanged) ───────── */
function mergeLiveMessages(prev, incoming) {
  if (!prev || prev.length === 0) return incoming
  if (!incoming || incoming.length === 0) return prev

  let hasChanges = false
  const prevMap = new Map()
  prev.forEach(m => prevMap.set(m.id, m))

  const incomingClientIdMap = new Map()
  incoming.forEach(inc => {
    if (inc.client_id) incomingClientIdMap.set(inc.client_id, inc)
  })

  const merged = []

  for (const inc of incoming) {
    let existing = prevMap.get(inc.id)
    if (!existing && inc.client_id) {
      existing = prev.find(m => m.clientId === inc.client_id || m.id === inc.client_id)
    }

    if (!existing) {
      merged.push(inc)
      hasChanges = true
    } else {
      const wasDeletedLocally = !!existing.deleted_at
      const finalDeletedAt = wasDeletedLocally ? existing.deleted_at : inc.deleted_at

      const bodyChanged = existing.body !== inc.body
      const deletedChanged = !!existing.deleted_at !== !!finalDeletedAt
      const readChanged = existing.read_at !== inc.read_at
      const updatedChanged = existing.updated_at !== inc.updated_at
      const editedChanged = existing.edited_at !== inc.edited_at
      const hadStatus = !!existing.status

      if (bodyChanged || deletedChanged || readChanged || updatedChanged || editedChanged || hadStatus) {
        merged.push({
          ...existing,
          ...inc,
          deleted_at: finalDeletedAt,
          body: finalDeletedAt ? null : (inc.body ?? existing.body),
          edited_at: inc.edited_at !== undefined ? inc.edited_at : existing.edited_at,
          status: undefined,
        })
        hasChanges = true
      } else {
        merged.push(existing)
      }
    }
  }

  // Preserve any in-flight optimistic or failed messages not yet in incoming
  const serverIds = new Set(incoming.map(inc => inc.id))
  for (const m of prev) {
    if ((m.status === 'sending' || m.status === 'failed') &&
        !serverIds.has(m.id) &&
        (!m.clientId || !incomingClientIdMap.has(m.clientId))) {
      merged.push(m)
    }
  }

  if (!hasChanges && prev.length === merged.length) {
    return prev
  }

  return merged
}

/* ── Main ChatbotWidget ──────────────────────────────────── */
export default function ChatbotWidget() {
  const { open, setOpen, messages, setMessages, chatRole, setChatRole } = useChatbot()
  const { user } = useAuth()
  const navigate  = useNavigate()
  const location  = useLocation()

  const messagesContainerRef = useRef(null)
  const bottomRef = useRef(null)
  const inputRef  = useRef(null)
  const isOpeningRef = useRef(false)
  const [typing, setTyping] = useState(false)

  // ── Network & Online State ─────────────────────────────────────
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // ── Live Chat State ───────────────────────────────────────────
  const [conversation, setConversation] = useState(null)
  const [chatMessages, setChatMessages] = useState([])
  const chatMessagesRef = useRef(chatMessages)
  chatMessagesRef.current = chatMessages
  const [chatStatus, setChatStatus] = useState(null)
  const [chatInput, setChatInput] = useState('')
  const [sendingMessage, setSendingMessage] = useState(false)
  const [lastSentAt, setLastSentAt] = useState(0)
  const liveMessagesContainerRef = useRef(null)
  const liveBottomRef = useRef(null)

  // Scroll tracking & "New messages" indicator
  const liveIsNearBottomRef = useRef(true)
  const [liveHasNewScrolledUp, setLiveHasNewScrolledUp] = useState(false)

  // ── Unread badge for FAB ──────────────────────────────────────
  const [unreadCount, setUnreadCount] = useState(0)

  // ── Message action state (touch + desktop) ────────────────────
  const [hoveredLiveMsgId, setHoveredLiveMsgId]   = useState(null)
  const [touchHoldingLiveMsgId, setTouchHoldingLiveMsgId] = useState(null)
  const [actionSheetMsg,  setActionSheetMsg]       = useState(null)
  const [desktopMenuData, setDesktopMenuData]      = useState(null) // { message, anchorRect }
  const [inlineEditingMsgId, setInlineEditingMsgId] = useState(null)
  const [inlineEditingText, setInlineEditingText]   = useState('')
  const [savingInlineEdit, setSavingInlineEdit]     = useState(false)
  const [deleteTargetMsg, setDeleteTargetMsg]       = useState(null)
  const [isDeletingMessage, setIsDeletingMessage]   = useState(false)
  const touchStartRef = useRef(null)
  const touchTimerRef = useRef(null)

  // Scroll listener for live messages container
  const handleLiveScroll = useCallback(() => {
    const el = liveMessagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNear = distanceFromBottom <= 80
    liveIsNearBottomRef.current = isNear
    if (isNear) {
      setLiveHasNewScrolledUp(false)
    }
  }, [])

  // Touch long-press handlers
  const handleTouchStart = (msg, e) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    setTouchHoldingLiveMsgId(msg.id)
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
    touchTimerRef.current = setTimeout(() => {
      setTouchHoldingLiveMsgId(null)
      touchStartRef.current = null
      if (navigator.vibrate) navigator.vibrate(25)
      setActionSheetMsg(msg)
    }, 500)
  }

  const handleTouchMove = (e) => {
    if (!touchStartRef.current || !touchTimerRef.current) return
    const t = e.touches[0]
    const dist = Math.hypot(t.clientX - touchStartRef.current.x, t.clientY - touchStartRef.current.y)
    if (dist > 10) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
      touchStartRef.current = null
      setTouchHoldingLiveMsgId(null)
    }
  }

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
    touchStartRef.current = null
    setTouchHoldingLiveMsgId(null)
  }

  // Soft Delete handlers (with confirmation dialog)
  const handleRequestDelete = (msg) => {
    setDesktopMenuData(null)
    setActionSheetMsg(null)
    setDeleteTargetMsg(msg)
  }

  const handleCancelDelete = () => {
    if (isDeletingMessage) return
    setDeleteTargetMsg(null)
  }

  const handleConfirmDelete = async () => {
    if (!deleteTargetMsg || isDeletingMessage) return
    const msg = deleteTargetMsg
    setIsDeletingMessage(true)
    const nowIso = new Date().toISOString()

    try {
      await chatApi.unsendMessage(msg.id)
      setChatMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, deleted_at: nowIso, body: null } : m)
      )
      toast.success('Message deleted.')
      setDeleteTargetMsg(null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete message.')
    } finally {
      setIsDeletingMessage(false)
    }
  }

  // Inline Edit handlers (Within 15 minutes with rollback on fail)
  const handleStartInlineEdit = (msg) => {
    setDesktopMenuData(null)
    setActionSheetMsg(null)
    setInlineEditingMsgId(msg.id)
    setInlineEditingText(msg.body || '')
  }

  const handleCancelInlineEdit = () => {
    setInlineEditingMsgId(null)
    setInlineEditingText('')
  }

  const handleSaveInlineEdit = async (msg) => {
    const trimmed = inlineEditingText.trim()
    if (!trimmed || trimmed === msg.body || savingInlineEdit) {
      setInlineEditingMsgId(null)
      return
    }

    const prevBody = msg.body
    setSavingInlineEdit(true)
    const nowIso = new Date().toISOString()
    setChatMessages(prev =>
      prev.map(m =>
        m.id === msg.id
          ? { ...m, body: trimmed, edited_at: nowIso }
          : m
      )
    )
    setInlineEditingMsgId(null)
    setInlineEditingText('')

    try {
      await chatApi.updateMessage(msg.id, trimmed)
      toast.success('Message updated.')
    } catch (err) {
      setChatMessages(prev =>
        prev.map(m =>
          m.id === msg.id
            ? { ...m, body: prevBody, edited_at: msg.edited_at }
            : m
        )
      )
      toast.error(err?.response?.data?.message || 'Failed to update message. Reverted.')
    } finally {
      setSavingInlineEdit(false)
    }
  }

  const isStudent = user?.role === 'student'
  const firstName = user?.name?.split(' ')[0] || 'there'
  const [chatEnabled, setChatEnabled] = useState(true)

  // Fetch whether live chat is enabled
  useEffect(() => {
    if (!isStudent) return
    let active = true
    const checkEnabled = async () => {
      try {
        const { data } = await adminApi.getSetting('chat_enabled')
        if (active) {
          setChatEnabled(data.value !== '0')
        }
      } catch {
        // keep default true
      }
    }
    checkEnabled()
    return () => { active = false }
  }, [isStudent, open])

  // Open live chat from URL query parameter e.g. ?chat=nurse
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const chatParam = params.get('chat')
    if (chatParam && (chatParam === 'nurse' || chatParam === 'dentist') && isStudent && chatEnabled) {
      setChatRole(chatParam)
      setOpen(true)
    }
  }, [location.search, isStudent, chatEnabled, setChatRole, setOpen])

  // ── Poll student unread count for FAB badge ───────────────────
  useEffect(() => {
    if (!isStudent) return
    let mounted = true
    const fetchUnread = async () => {
      if (open) return
      try {
        const { data } = await chatApi.getStudentUnreadCount()
        if (mounted && !open) {
          setUnreadCount(data.unread_count || 0)
        }
      } catch {
        // silently ignore
      }
    }
    fetchUnread()
    const interval = setInterval(fetchUnread, 5000)
    const handleUpdate = () => fetchUnread()
    window.addEventListener('messages-updated', handleUpdate)

    return () => {
      mounted = false
      clearInterval(interval)
      window.removeEventListener('messages-updated', handleUpdate)
    }
  }, [isStudent, open])

  // Clear badge when chat opens & mark replies read on server
  useEffect(() => {
    if (open && isStudent) {
      setUnreadCount(0)
      chatApi.markStudentAllRead().catch(() => {})
    }
  }, [open, isStudent])

  // Scroll Q&A bottom
  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior, block: 'end', inline: 'nearest' })
    }
  }, [])

  // Scroll Live Chat bottom
  const scrollToLiveBottom = useCallback((behavior = 'auto') => {
    if (liveMessagesContainerRef.current) {
      liveMessagesContainerRef.current.scrollTo({
        top: liveMessagesContainerRef.current.scrollHeight,
        behavior,
      })
      liveIsNearBottomRef.current = true
      setLiveHasNewScrolledUp(false)
    }
  }, [])

  // Scroll Live Chat whenever messages change (only if near bottom)
  useEffect(() => {
    if (chatRole && open && liveIsNearBottomRef.current) {
      scrollToLiveBottom('smooth')
    }
  }, [chatMessages, chatRole, open, scrollToLiveBottom])

  // ── Online / Offline Network Listeners ───────────────────────
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // ── Live Chat Polling (Every 4 seconds, paused when hidden or offline) ──
  useEffect(() => {
    if (!open || !chatRole || !isStudent) return

    let isMounted = true

    const fetchChatData = async () => {
      if (document.hidden || !isOnline) return
      try {
        const [convRes, statusRes] = await Promise.all([
          chatApi.getStudentConversation(chatRole),
          chatApi.getStatus(chatRole),
        ])
        if (isMounted) {
          if (convRes.data) {
            setConversation(prev => {
              if (!prev) return convRes.data
              if (prev.status !== convRes.data.status || prev.last_message_at !== convRes.data.last_message_at) {
                return { ...prev, ...convRes.data }
              }
              return prev
            })
            setChatMessages(prev => {
              const incoming = convRes.data.messages || []
              const merged = mergeLiveMessages(prev, incoming)
              if (merged.length > prev.length) {
                const lastIncoming = merged[merged.length - 1]
                if (!liveIsNearBottomRef.current && lastIncoming.sender_id !== user?.id) {
                  setLiveHasNewScrolledUp(true)
                }
              }
              return merged
            })
          }
          if (statusRes.data) {
            setChatStatus(statusRes.data)
          }
        }
      } catch {
        // Silent error to prevent flicker
      }
    }

    // Immediate fetch when open and online
    if (isOnline) {
      fetchChatData()
    }

    // 4 second polling (only runs when online)
    const interval = setInterval(() => {
      if (isOnline) fetchChatData()
    }, 4000)

    const handleVisibilityChange = () => {
      if (!document.hidden && isOnline) {
        fetchChatData()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [open, chatRole, isStudent, user?.id, isOnline])

  // Scroll to bottom each time Q&A opens
  useEffect(() => {
    if (!open || chatRole) return

    isOpeningRef.current = true
    scrollToBottom('auto')

    const rafId = requestAnimationFrame(() => {
      scrollToBottom('auto')
      requestAnimationFrame(() => scrollToBottom('auto'))
    })

    const t1 = setTimeout(() => scrollToBottom('auto'), 50)
    const t2 = setTimeout(() => scrollToBottom('auto'), 150)
    const t3 = setTimeout(() => {
      scrollToBottom('auto')
      isOpeningRef.current = false
    }, 350)

    const focusTimer = setTimeout(() => inputRef.current?.focus(), 200)

    if (messages.length === 0) {
      initMenu()
    }

    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
      clearTimeout(focusTimer)
    }
  }, [open, chatRole, scrollToBottom])

  // Track layout changes during opening
  useEffect(() => {
    if (!open || !messagesContainerRef.current || chatRole) return
    const container = messagesContainerRef.current
    const ro = new ResizeObserver(() => {
      if (isOpeningRef.current) {
        scrollToBottom('auto')
      }
    })
    ro.observe(container)
    return () => ro.disconnect()
  }, [open, chatRole, scrollToBottom])

  // Scroll to bottom on Q&A messages/typing
  useEffect(() => {
    if (!open || chatRole) return
    scrollToBottom('smooth')
    const t = setTimeout(() => scrollToBottom('smooth'), 60)
    return () => clearTimeout(t)
  }, [messages, typing, open, chatRole, scrollToBottom])

  const buildNavActions = (category) => {
    const role = user?.role || 'student'
    const actions = getNavActions(category, role)
    return actions.map(a => ({ ...a, onClick: () => navigate(a.path) }))
  }

  const pushBotWithDelay = useCallback((msg, delay = 600) => {
    setTyping(true)
    setTimeout(() => {
      setTyping(false)
      setMessages(prev => [...prev, { id: Date.now() + '_bot', from: 'bot', ts: Date.now(), ...msg }])
    }, delay)
  }, [setMessages])

  const pushUser = (text) => {
    setMessages(prev => [...prev, { id: Date.now() + '_user', from: 'user', ts: Date.now(), text }])
  }

  const pushErr = (text = 'Something went wrong. Please try again.') => {
    setTyping(false)
    setMessages(prev => [
      ...prev,
      {
        id: Date.now() + '_err',
        from: 'bot',
        ts: Date.now(),
        text,
        chatButtons: isStudent,
      },
    ])
  }

  /* ── Load top-level menu ──────────────────────────────────── */
  const initMenu = async () => {
    try {
      const { data } = await chatbotApi.menu()
      const greeting = `${getGreeting()}, ${firstName}!`
      setMessages([{
        id: 'welcome',
        from: 'bot',
        ts: Date.now(),
        text: `${greeting} What can I help you with today?`,
        buttons: (data.buttons || []).map(b => ({ label: b.label, value: b.value ?? b.category })),
        onButtonClick: handleCategorySelect,
      }])
    } catch {
      setMessages([{
        id: 'err',
        from: 'bot',
        ts: Date.now(),
        text: 'Unable to connect right now. Please try again later.',
      }])
    }
  }

  /* ── Category selected ────────────────────────────────────── */
  const handleCategorySelect = async (btn) => {
    pushUser(btn.label)
    try {
      const { data } = await chatbotApi.category(btn.value)
      if (data.type === 'subtopics') {
        pushBotWithDelay({
          text: `Here are the areas under **${btn.label}**:`,
          buttons: (data.buttons || []).map(b => ({ label: b.label, value: b.value ?? b.category })),
          onButtonClick: handleCategorySelect,
        })
      } else {
        pushBotWithDelay({
          text: data.faqs?.length
            ? `Here's what I know about **${btn.label}** — pick a question:`
            : `No FAQs found for **${btn.label}** yet.`,
          faqs: data.faqs || [],
          onFaqClick: handleFaqSelect,
        })
      }
    } catch {
      pushErr('Could not load that topic. Try again.')
    }
  }

  /* ── Suggestion chip clicked ──────────────────────────────── */
  const handleCategoryChip = (chip) => {
    handleCategorySelect({ label: chip.label, value: chip.value })
  }

  /* ── FAQ item selected ────────────────────────────────────── */
  const handleFaqSelect = async (faq) => {
    pushUser(faq.question)

    const buildAnswer = (item) => {
      const cat = item.category || faq.category
      const navActions = buildNavActions(cat)
      return {
        text: `**${item.question}**\n\n${item.answer}`,
        navActions,
        suggestions: getSuggestions(cat, navActions),
      }
    }

    if (faq.answer) {
      pushBotWithDelay(buildAnswer(faq))
      return
    }

    try {
      const { data } = await chatbotApi.faq(faq.id)
      const item = data.faq ?? data
      pushBotWithDelay(buildAnswer(item))
    } catch {
      pushErr('Could not load that answer. Please try again.')
    }
  }

  /* ── Q&A Free-text send ───────────────────────────────────── */
  const handleSend = async () => {
    const inputField = document.getElementById('chatbot-input')
    const query = inputField ? inputField.value.trim() : ''
    if (!query) return
    if (inputField) inputField.value = ''

    pushUser(query)

    try {
      const { data } = await chatbotApi.message(query)

      if (data.type === 'menu') {
        pushBotWithDelay({
          text: data.message,
          buttons: (data.buttons || []).map(b => ({ label: b.label, value: b.value ?? b.category })),
          onButtonClick: handleCategorySelect,
        })
      } else if (data.type === 'faq_list') {
        pushBotWithDelay({
          text: data.message,
          faqs: data.faqs || [],
          onFaqClick: handleFaqSelect,
        })
      } else if (data.type === 'subtopics') {
        pushBotWithDelay({
          text: data.message,
          buttons: (data.buttons || []).map(b => ({ label: b.label, value: b.value ?? b.category })),
          onButtonClick: handleCategorySelect,
        })
      } else if (data.type === 'answer') {
        const navActions = buildNavActions(data.category)
        pushBotWithDelay({
          text: `**${data.question}**\n\n${data.answer}`,
          navActions,
          suggestions: getSuggestions(data.category, navActions),
        })
      } else {
        pushBotWithDelay({
          text: data.message || "I couldn't find an answer for that. You can chat directly with our clinic staff:",
          chatButtons: isStudent && chatEnabled,
        })
      }
    } catch {
      pushErr()
    }
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleReset = async () => {
    setMessages([])
    setTyping(false)
    await initMenu()
  }

  /* ── Live Chat Optimistic Send & Retry (Student) ─────────── */
  const sendPendingMessage = async (msgToRetry) => {
    const targetClientId = msgToRetry.clientId || msgToRetry.id
    const targetText = msgToRetry.body
    if (!conversation?.id || !targetText) return

    setChatMessages(prev =>
      prev.map(m => (m.clientId === targetClientId || m.id === targetClientId ? { ...m, status: 'sending' } : m))
    )
    setSendingMessage(true)

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setChatMessages(prev =>
        prev.map(m => (m.clientId === targetClientId || m.id === targetClientId ? { ...m, status: 'failed' } : m))
      )
      setSendingMessage(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const { data } = await chatApi.sendMessage(conversation.id, targetText, targetClientId, {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      setChatMessages(prev =>
        prev.map(m => (m.clientId === targetClientId || m.id === targetClientId ? { ...data.message, status: undefined } : m))
      )
      liveIsNearBottomRef.current = true
      setLiveHasNewScrolledUp(false)
      scrollToLiveBottom('smooth')
    } catch (err) {
      clearTimeout(timeoutId)
      setChatMessages(prev =>
        prev.map(m => (m.clientId === targetClientId || m.id === targetClientId ? { ...m, status: 'failed' } : m))
      )
    } finally {
      setSendingMessage(false)
    }
  }

  const handleRetry = (msg) => {
    sendPendingMessage(msg)
  }

  const handleRemoveOptimistic = (targetId) => {
    setChatMessages(prev => prev.filter(m => m.id !== targetId && m.clientId !== targetId))
  }

  const handleLiveSend = async (e) => {
    if (e) e.preventDefault()
    const text = chatInput.trim()
    if (!text || sendingMessage || !conversation?.id) return

    // 2-second spam control
    const now = Date.now()
    if (now - lastSentAt < 2000) return
    setLastSentAt(now)

    const clientId = generateClientId()
    const optimisticMsg = {
      id: clientId,
      clientId,
      body: text,
      sender_id: user?.id,
      sender: { id: user?.id, name: user?.name, role: user?.role },
      created_at: new Date().toISOString(),
      status: 'sending',
    }

    setChatInput('')
    setChatMessages(prev => [...prev, optimisticMsg])
    liveIsNearBottomRef.current = true
    setLiveHasNewScrolledUp(false)
    scrollToLiveBottom('smooth')

    sendPendingMessage(optimisticMsg)
  }

  // Auto-send pending/failed messages when back online
  useEffect(() => {
    if (isOnline) {
      const pending = (chatMessagesRef.current || []).filter(m => m.status === 'failed')
      if (pending.length > 0) {
        ;(async () => {
          for (const m of pending) {
            await sendPendingMessage(m)
          }
        })()
      }
    }
  }, [isOnline])

  /* ── Build message list with date separators ─────────────── */
  function buildLiveMessageList(msgs) {
    const result = []
    let lastDateLabel = null

    msgs.forEach((m, idx) => {
      const dateLabel = getDateLabel(m.created_at)
      if (dateLabel && dateLabel !== lastDateLabel) {
        lastDateLabel = dateLabel
        result.push({ type: 'separator', key: `sep-${idx}`, label: dateLabel })
      }
      result.push({ type: 'message', key: m.clientId || m.id, msg: m })
    })

    return result
  }

  /* ── Determine if "Seen" should show under last message ──── */
  function getSeenLabel(msgs, myUserId) {
    // Find the last message sent by the current user (confirmed and not deleted)
    const myMsgs = msgs.filter(m => m.sender_id === myUserId && !m.deleted_at && !m.status)
    if (myMsgs.length === 0) return null
    const lastMine = myMsgs[myMsgs.length - 1]
    // Check if staff has read it (read_at on a message sent by student means staff saw it)
    if (lastMine.read_at) return 'Seen'
    return null
  }

  const liveItems = buildLiveMessageList(chatMessages)
  const seenLabel = conversation ? getSeenLabel(chatMessages, user?.id) : null

  return (
    <>
      {/* FAB trigger */}
      {!open && (
        <button
          id="chatbot-fab"
          className="chatbot-fab"
          onClick={() => setOpen(true)}
          title="FSUU Clinic Assistant"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"
            style={{ marginRight: '5px' }}>
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
          </svg>
          <span className="chatbot-fab-label">Help Assistant</span>
          {unreadCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '-6px',
              right: '-6px',
              minWidth: '18px',
              height: '18px',
              borderRadius: '9px',
              background: '#ef4444',
              color: '#fff',
              fontSize: '0.68rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 4px',
              border: '2px solid #fff',
              lineHeight: 1,
            }}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      )}

      {/* Chat window */}
      {open && (
        <div className="chatbot-window" role="dialog" aria-label="FSUU Clinic Chatbot">

          {/* ═════════════════════════════════════════════════════════
             VIEW A: LIVE CHAT VIEW (Student <-> Nurse/Dentist)
             ═════════════════════════════════════════════════════════ */}
          {chatRole ? (
            <>
              {/* Header */}
              <div className="chatbot-header">
                <div className="chatbot-header-info">
                  <div className="chatbot-avatar-sm">
                    <SvgIcon name={chatRole === 'dentist' ? 'dental' : 'nurse'} size={15} />
                  </div>
                  <div>
                    <div className="chatbot-name">
                      {chatStatus?.staff_name
                        ? chatStatus.staff_name
                        : `Chat with ${chatRole === 'dentist' ? 'Dentist' : 'Nurse'}`}
                    </div>
                    <div className="chatbot-status">
                      <span
                        className={`chatbot-dot ${chatStatus?.is_online ? 'chatbot-dot-pulse' : ''}`}
                        style={{
                          background: chatStatus?.is_online ? '#22c55e' : 'var(--text-muted, #94a3b8)',
                        }}
                      />
                      {chatStatus?.is_online ? 'Online' : 'Offline'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button
                    className="chatbot-icon-btn"
                    onClick={() => setChatRole(null)}
                    style={{
                      width: 'auto',
                      padding: '0 0.55rem',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                    }}
                    title="Return to FAQ"
                  >
                    Back to Q&amp;A
                  </button>
                  <button
                    className="chatbot-icon-btn"
                    onClick={() => setOpen(false)}
                    title="Close"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Clinic Info hotline note */}
              <div
                style={{
                  padding: '0.5rem 0.85rem',
                  background: 'var(--bg, #f8fafc)',
                  borderBottom: '1px solid var(--border)',
                  fontSize: '0.76rem',
                  lineHeight: 1.45,
                  color: 'var(--text-sub)',
                }}
              >
                <div>
                  Clinic Hotline: <strong>{chatStatus?.clinic_hotline || '(085) 342-1830 local 124'}</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  General inquiries only, not medical diagnosis
                </div>
              </div>

              {/* Offline Banner (Schedule) */}
              {chatStatus && !chatStatus.is_online && (
                <div
                  style={{
                    padding: '0.5rem 0.85rem',
                    background: 'rgba(234, 179, 8, 0.1)',
                    borderBottom: '1px solid rgba(234, 179, 8, 0.25)',
                    fontSize: '0.76rem',
                    lineHeight: 1.45,
                    color: 'var(--text)',
                  }}
                >
                  {chatStatus.offline_message ||
                    `Currently offline. Your message will be answered during clinic hours. (${chatStatus.clinic_hours})`}
                </div>
              )}

              {/* Internet Connection Offline Banner */}
              {!isOnline && (
                <div
                  style={{
                    padding: '0.45rem 0.85rem',
                    background: 'rgba(234, 179, 8, 0.15)',
                    borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
                    fontSize: '0.76rem',
                    lineHeight: 1.4,
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 500,
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                    <line x1="1" y1="1" x2="23" y2="23" />
                    <path d="M16.72 11.06A10.94 10.94 0 0119 12.55" />
                    <path d="M5 12.55a10.94 10.94 0 015.17-2.39" />
                    <path d="M10.71 5.05A16 16 0 0122.58 9" />
                    <path d="M1.42 9a15.91 15.91 0 014.7-2.88" />
                    <path d="M8.53 16.11a6 6 0 016.95 0" />
                    <line x1="12" y1="20" x2="12.01" y2="20" />
                  </svg>
                  <span>No internet connection. Messages will be sent when you are back online.</span>
                </div>
              )}

              {/* Live Messages List */}
              <div
                className="chatbot-messages"
                ref={liveMessagesContainerRef}
                onScroll={handleLiveScroll}
                style={{ flex: 1, overflowY: 'auto', padding: '0.85rem', position: 'relative' }}
              >
                {chatMessages.length === 0 ? (
                  <div
                    style={{
                      textAlign: 'center',
                      padding: '2rem 1rem',
                      color: 'var(--text-muted)',
                      fontSize: '0.82rem',
                    }}
                  >
                    No messages yet. Send a message to start the conversation.
                  </div>
                ) : (
                  <>
                    {liveItems.map(item => {
                      if (item.type === 'separator') {
                        return <DateSeparator key={item.key} label={item.label} />
                      }
                      const m = item.msg
                      const isSending = m.status === 'sending'
                      const isFailed = m.status === 'failed'
                      const isStudentSender = (m.sender_id === user?.id)
                      const isRemoved = !!m.deleted_at
                      const isLastMine = isStudentSender &&
                        chatMessages.filter(x => x.sender_id === user?.id && !x.deleted_at && !x.status).slice(-1)[0]?.id === m.id &&
                        !isSending && !isFailed
                      const isEdited = !isRemoved && Boolean(m.edited_at)
                      const isBeingEdited = inlineEditingMsgId === m.id

                      return (
                        <div
                          key={item.key}
                          onMouseEnter={() => setHoveredLiveMsgId(m.id)}
                          onMouseLeave={() => setHoveredLiveMsgId(null)}
                        >
                          {/* Sender name for staff messages */}
                          {!isStudentSender && m.sender?.name && !isRemoved && (
                            <div style={{
                              fontSize: '0.7rem',
                              color: 'var(--text-muted)',
                              marginBottom: '2px',
                              paddingLeft: '2px',
                            }}>
                              {m.sender.name}
                            </div>
                          )}

                          {isBeingEdited ? (
                            <div
                              style={{
                                background: 'var(--bg-surface, #ffffff)',
                                border: '1.5px solid var(--accent)',
                                borderRadius: '12px',
                                padding: '8px 10px',
                                boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
                                width: '100%',
                                boxSizing: 'border-box',
                                marginBottom: '4px',
                              }}
                            >
                              <textarea
                                rows={2}
                                value={inlineEditingText}
                                onChange={e => setInlineEditingText(e.target.value)}
                                maxLength={500}
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSaveInlineEdit(m)
                                  } else if (e.key === 'Escape') {
                                    handleCancelInlineEdit()
                                  }
                                }}
                                style={{
                                  width: '100%',
                                  border: 'none',
                                  outline: 'none',
                                  background: 'transparent',
                                  resize: 'none',
                                  fontSize: '0.82rem',
                                  color: 'var(--text, #0f172a)',
                                  fontFamily: 'inherit',
                                  lineHeight: 1.45,
                                  boxSizing: 'border-box',
                                }}
                              />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '6px' }}>
                                <button
                                  type="button"
                                  onClick={handleCancelInlineEdit}
                                  style={{
                                    padding: '3px 8px',
                                    fontSize: '0.74rem',
                                    borderRadius: 'var(--radius-sm, 6px)',
                                    border: '1px solid var(--border)',
                                    background: 'transparent',
                                    color: 'var(--text-sub)',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  disabled={savingInlineEdit || !inlineEditingText.trim() || inlineEditingText.trim() === m.body}
                                  onClick={() => handleSaveInlineEdit(m)}
                                  style={{
                                    padding: '3px 10px',
                                    fontSize: '0.74rem',
                                    borderRadius: 'var(--radius-sm, 6px)',
                                    border: 'none',
                                    background: 'var(--accent)',
                                    color: '#ffffff',
                                    cursor: 'pointer',
                                    fontWeight: 600,
                                  }}
                                >
                                  {savingInlineEdit ? 'Saving…' : 'Save'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div
                              className={`chat-msg-row ${isStudentSender ? 'own' : 'other'}`}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: isStudentSender ? 'flex-end' : 'flex-start',
                                gap: '8px',
                                width: '100%',
                                boxSizing: 'border-box',
                              }}
                            >
                              {/* Three-dot Button on LEFT of user's own message with 8px gap (shown on row hover/focus) */}
                              {isStudentSender && !isRemoved && !isSending && !isFailed && (
                                <button
                                  type="button"
                                  className={`chat-msg-actions-btn ${desktopMenuData?.message?.id === m.id ? 'active' : ''}`}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const rect = e.currentTarget.getBoundingClientRect()
                                    setDesktopMenuData(prev =>
                                      prev?.message?.id === m.id ? null : { message: m, anchorRect: rect }
                                    )
                                  }}
                                  title="Message options"
                                  aria-label="Message options"
                                >
                                  <MoreDotsIcon size={14} />
                                </button>
                              )}

                              {/* Message Bubble: max-width 70%, fit-content, min-width 80px, normal word wrapping */}
                              <div
                                className={`chat-bubble ${isStudentSender ? 'user own-bubble' : 'bot'} ${touchHoldingLiveMsgId === m.id ? 'is-holding' : ''}`}
                                style={{
                                  maxWidth: '70%',
                                  width: 'fit-content',
                                  minWidth: '80px',
                                  padding: '10px 14px',
                                  opacity: isRemoved ? 0.6 : (isSending ? 0.65 : 1),
                                  fontStyle: (isRemoved || isSending) ? 'italic' : 'normal',
                                  overflowWrap: 'break-word',
                                  wordBreak: 'normal',
                                  whiteSpace: 'pre-wrap',
                                  boxSizing: 'border-box',
                                }}
                                onContextMenu={isStudentSender && !isRemoved && !isSending && !isFailed ? e => e.preventDefault() : undefined}
                                onTouchStart={isStudentSender && !isRemoved && !isSending && !isFailed ? e => handleTouchStart(m, e) : undefined}
                                onTouchMove={isStudentSender && !isRemoved && !isSending && !isFailed ? handleTouchMove : undefined}
                                onTouchEnd={isStudentSender && !isRemoved && !isSending && !isFailed ? handleTouchEnd : undefined}
                                onTouchCancel={isStudentSender && !isRemoved && !isSending && !isFailed ? handleTouchEnd : undefined}
                              >
                                <div style={{ overflowWrap: 'break-word', wordBreak: 'normal', whiteSpace: 'pre-wrap' }}>
                                  {isRemoved ? 'Message removed' : m.body}
                                </div>
                                <div
                                  className="chat-bubble-meta"
                                  style={{
                                    fontSize: '0.68rem',
                                    marginTop: '4px',
                                    opacity: isStudentSender ? 0.8 : 0.65,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'flex-end',
                                    gap: '4px',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {isSending ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="10" />
                                        <polyline points="12 6 12 12 16 14" />
                                      </svg>
                                      <span>Sending</span>
                                    </span>
                                  ) : (
                                    <>
                                      <span>{formatTime(m.created_at)}</span>
                                      {isEdited && <span>• Edited</span>}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Failed Send Actions */}
                          {isFailed && (
                            <div
                              style={{
                                textAlign: 'right',
                                fontSize: '0.72rem',
                                color: '#ef4444',
                                marginTop: '3px',
                                display: 'flex',
                                gap: '8px',
                                justifyContent: 'flex-end',
                                alignItems: 'center',
                                paddingRight: '4px',
                              }}
                            >
                              <span>Failed to send</span>
                              <button
                                type="button"
                                onClick={() => handleRetry(m)}
                                style={{
                                  color: 'var(--accent)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  fontWeight: 600,
                                  padding: 0,
                                }}
                              >
                                Retry
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveOptimistic(m.clientId || m.id)}
                                style={{
                                  color: 'var(--text-muted, #94a3b8)',
                                  background: 'none',
                                  border: 'none',
                                  cursor: 'pointer',
                                  fontSize: '0.72rem',
                                  padding: 0,
                                }}
                              >
                                Delete
                              </button>
                            </div>
                          )}

                          {/* Seen label under last own message */}
                          {isLastMine && seenLabel && (
                            <div style={{
                              textAlign: 'right',
                              fontSize: '0.68rem',
                              color: 'var(--text-muted)',
                              marginTop: '2px',
                              paddingRight: '4px',
                            }}>
                              {seenLabel}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </>
                )}
                <div ref={liveBottomRef} style={{ height: '1px', flexShrink: 0 }} />

                {/* Floating "New messages" pill button */}
                {liveHasNewScrolledUp && (
                  <button
                    type="button"
                    onClick={() => scrollToLiveBottom('smooth')}
                    style={{
                      position: 'sticky',
                      bottom: '8px',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      zIndex: 20,
                      background: 'var(--accent)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '9999px',
                      padding: '5px 14px',
                      fontSize: '0.74rem',
                      fontWeight: 600,
                      boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
                      cursor: 'pointer',
                      display: 'block',
                      margin: '0 auto',
                    }}
                  >
                    New messages
                  </button>
                )}
              </div>

              {/* Live Chat Input (No placeholders!) */}
              <form onSubmit={handleLiveSend} className="chatbot-input-area">
                <input
                  type="text"
                  className="chatbot-input"
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  maxLength={500}
                  disabled={sendingMessage}
                  autoFocus
                />
                <button
                  type="submit"
                  className="chatbot-send-btn"
                  disabled={sendingMessage || !chatInput.trim()}
                  style={{ width: 'auto', padding: '0 0.85rem', gap: '5px' }}
                >
                  <SvgIcon name="send" size={14} />
                  {sendingMessage ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            /* ═════════════════════════════════════════════════════════
               VIEW B: PREDEFINED Q&A HELP ASSISTANT (Existing)
               ═════════════════════════════════════════════════════════ */
            <>
              {/* Header */}
              <div className="chatbot-header">
                <div className="chatbot-header-info">
                  <div className="chatbot-avatar-sm">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="chatbot-name">FSUU Clinic Assistant</div>
                    <div className="chatbot-status">
                      <span className="chatbot-dot chatbot-dot-pulse" />
                      Online · Rule-based FAQ bot
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="chatbot-icon-btn" onClick={handleReset} title="Restart">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                      strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 109-9H3M3 3v6h6" />
                    </svg>
                  </button>
                  <button className="chatbot-icon-btn" onClick={() => setOpen(false)} title="Close">✕</button>
                </div>
              </div>

              {/* Messages */}
              <div className="chatbot-messages" id="chatbot-messages" ref={messagesContainerRef}>
                {messages.map(msg => (
                  <Bubble
                    key={msg.id}
                    msg={msg}
                    onCategoryChip={handleCategoryChip}
                    onStartChat={(role) => setChatRole(role)}
                  />
                ))}
                {typing && <TypingIndicator />}
                <div ref={bottomRef} style={{ height: '1px', flexShrink: 0 }} />
              </div>

              {/* Student Entry Points to Live Chat at bottom of Q&A */}
              {isStudent && chatEnabled && (
                <div
                  style={{
                    display: 'flex',
                    gap: '0.5rem',
                    padding: '0.45rem 0.85rem',
                    borderTop: '1px solid var(--border)',
                    background: 'var(--bg, #f8fafc)',
                  }}
                >
                  <button
                    type="button"
                    className="chat-menu-btn"
                    style={{ flex: 1, margin: 0, justifyContent: 'center', fontSize: '0.78rem', padding: '0.4rem 0.5rem' }}
                    onClick={() => setChatRole('nurse')}
                  >
                    <SvgIcon name="nurse" size={13} />
                    <span>Chat with Nurse</span>
                  </button>
                  <button
                    type="button"
                    className="chat-menu-btn"
                    style={{ flex: 1, margin: 0, justifyContent: 'center', fontSize: '0.78rem', padding: '0.4rem 0.5rem' }}
                    onClick={() => setChatRole('dentist')}
                  >
                    <SvgIcon name="dental" size={13} />
                    <span>Chat with Dentist</span>
                  </button>
                </div>
              )}

              {/* Input */}
              <div className="chatbot-input-area">
                <input
                  ref={inputRef}
                  id="chatbot-input"
                  className="chatbot-input"
                  type="text"
                  onKeyDown={handleKey}
                  maxLength={500}
                  disabled={typing}
                />
                <button
                  id="chatbot-send"
                  className="chatbot-send-btn"
                  onClick={handleSend}
                  title="Send"
                  disabled={typing}
                  style={{ width: 'auto', padding: '0 0.85rem', gap: '5px' }}
                >
                  <SvgIcon name="send" size={14} />
                  Send
                </button>
              </div>
            </>
          )}

          {/* Touch action bottom sheet (Rendered via Portal) */}
          <MessageActionSheet
            message={actionSheetMsg}
            onClose={() => setActionSheetMsg(null)}
            onEdit={(msg) => handleStartInlineEdit(msg)}
            onDelete={(msg) => handleRequestDelete(msg)}
          />

          {/* Desktop action menu (Rendered via Portal) */}
          <DesktopActionMenu
            message={desktopMenuData?.message}
            anchorRect={desktopMenuData?.anchorRect}
            isOpen={Boolean(desktopMenuData)}
            onClose={() => setDesktopMenuData(null)}
            onEdit={(msg) => handleStartInlineEdit(msg)}
            onDelete={(msg) => handleRequestDelete(msg)}
          />

          {/* Confirmation Modal before deleting message */}
          <DeleteMessageModal
            isOpen={Boolean(deleteTargetMsg)}
            onClose={handleCancelDelete}
            onConfirm={handleConfirmDelete}
            isDeleting={isDeletingMessage}
          />

        </div>
      )}
    </>
  )
}
