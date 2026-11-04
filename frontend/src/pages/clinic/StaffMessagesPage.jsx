import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Pagination from '../../components/Pagination'
import { chatApi } from '../../api/chat'
import { useAuth } from '../../context/AuthContext'
import {
  MessageActionSheet,
  DesktopActionMenu,
  MoreDotsIcon,
} from '../../components/MessageActionSheet'
import DeleteMessageModal from '../../components/DeleteMessageModal'
import Avatar from '../../components/Avatar'

/* ── Date and Time Formatting Helpers ─────────────────────────────── */

function formatMessageTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  if (isToday) {
    return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
  }
  return d.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })
}

function formatTimeOnly(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true })
}

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

function getInitials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

/* ── Build Flattened Message List with Spacing & Separators ───────── */

function buildMessageItems(msgs) {
  const result = []
  let lastDateLabel = null

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i]
    const dateLabel = getDateLabel(m.created_at)

    let hadDateSeparator = false
    if (dateLabel && dateLabel !== lastDateLabel) {
      lastDateLabel = dateLabel
      result.push({ type: 'separator', key: `sep-${i}`, label: dateLabel })
      hadDateSeparator = true
    }

    const prevMsg = i > 0 ? msgs[i - 1] : null
    const isSameSender = !hadDateSeparator && prevMsg && prevMsg.sender_id === m.sender_id
    const isFirstInRun = !isSameSender

    result.push({
      type: 'message',
      key: m.id,
      msg: m,
      spacingTop: isSameSender ? '4px' : '12px',
      isFirstInRun,
    })
  }

  return result
}

function generateClientId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  return 'cid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10)
}

/* ── Silent Merge Helpers (prevents re-render if unchanged) ───────── */

function mergeMessages(prev, incoming) {
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

function mergeConversations(prev, incoming) {
  if (!prev || prev.length === 0) return incoming
  if (!incoming || incoming.length === 0) return prev

  let hasChanges = false
  const prevMap = new Map()
  prev.forEach(c => prevMap.set(c.id, c))

  const merged = []

  for (const inc of incoming) {
    const existing = prevMap.get(inc.id)
    if (!existing) {
      merged.push(inc)
      hasChanges = true
    } else {
      const statusChanged = existing.status !== inc.status
      const unreadChanged = existing.unread_count !== inc.unread_count
      const lastMsgChanged =
        existing.latest_message?.body !== inc.latest_message?.body ||
        existing.latest_message?.created_at !== inc.latest_message?.created_at ||
        existing.last_message_at !== inc.last_message_at

      if (statusChanged || unreadChanged || lastMsgChanged) {
        merged.push({ ...existing, ...inc })
        hasChanges = true
      } else {
        merged.push(existing)
      }
    }
  }

  if (!hasChanges && prev.length === merged.length) {
    return prev
  }

  return merged
}

/* ═════════════════════════════════════════════════════════════════════
   STAFF MESSAGES PAGE COMPONENT
   ═════════════════════════════════════════════════════════════════════ */

export default function StaffMessagesPage() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  // Conversations list & selection
  const [activeTab, setActiveTab] = useState('open') // 'open' | 'resolved'
  const [allConversations, setAllConversations] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [conversation, setConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const messagesRef = useRef(messages)
  messagesRef.current = messages
  const [loadingList, setLoadingList] = useState(true)

  // Network & Online state
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)

  // Input & sending
  const [inputText, setInputText] = useState('')
  const [sending, setSending] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const lastSentAtRef = useRef(0)

  // Hover & selection states
  const [hoveredConvId, setHoveredConvId] = useState(null)
  const [hoveredMsgId, setHoveredMsgId] = useState(null)

  // Scroll tracking & "New messages" indicator
  const messagesScrollRef = useRef(null)
  const isNearBottomRef = useRef(true)
  const [hasNewScrolledUp, setHasNewScrolledUp] = useState(false)

  // Desktop action menu state (Portal)
  const [desktopMenuData, setDesktopMenuData] = useState(null) // { message, anchorRect }

  // Touch bottom sheet state
  const [actionSheetMsg, setActionSheetMsg] = useState(null)
  const [touchHoldingMsgId, setTouchHoldingMsgId] = useState(null)
  const touchStartRef = useRef(null)
  const touchTimerRef = useRef(null)

  // Inline edit state
  const [editingMsgId, setEditingMsgId] = useState(null)
  const [inlineEditText, setInlineEditText] = useState('')
  const [savingEdit, setSavingEdit] = useState(false)

  // Delete message confirmation modal state
  const [deleteTargetMsg, setDeleteTargetMsg] = useState(null)
  const [isDeletingMessage, setIsDeletingMessage] = useState(false)

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

  /* ── Heartbeat for staff presence (every 45s) ──────────────────── */
  useEffect(() => {
    chatApi.heartbeat().catch(() => {})
    const hbInterval = setInterval(() => {
      chatApi.heartbeat().catch(() => {})
    }, 45000)
    return () => clearInterval(hbInterval)
  }, [])

  /* ── Scroll Helpers ────────────────────────────────────────────── */

  const scrollToBottom = useCallback((behavior = 'auto') => {
    if (messagesScrollRef.current) {
      messagesScrollRef.current.scrollTo({
        top: messagesScrollRef.current.scrollHeight,
        behavior,
      })
      isNearBottomRef.current = true
      setHasNewScrolledUp(false)
    }
  }, [])

  const handleScroll = useCallback(() => {
    const el = messagesScrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNear = distanceFromBottom <= 80
    isNearBottomRef.current = isNear
    if (isNear) {
      setHasNewScrolledUp(false)
    }
  }, [])

  // Auto-scroll when messages update (only if near bottom or initial)
  useEffect(() => {
    if (isNearBottomRef.current) {
      scrollToBottom('smooth')
    }
  }, [messages, scrollToBottom])

  /* ── Sync selectedId with URL parameter `?id=...` ───────────────── */
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const paramId = params.get('id')
    if (paramId) {
      const numId = parseInt(paramId, 10)
      if (!isNaN(numId)) {
        setSelectedId(numId)
      }
    }
  }, [location.search])

  /* ── Initial Load of All Conversations ──────────────────────────── */
  useEffect(() => {
    let isMounted = true
    setLoadingList(true)
    chatApi
      .listConversations()
      .then(({ data }) => {
        if (!isMounted) return
        const list = data || []
        setAllConversations(list)

        // If no conversation currently selected and we have items matching open, select first
        if (selectedId === null && list.length > 0) {
          const firstOpen = list.find(c => c.status === 'open') || list[0]
          setSelectedId(firstOpen.id)
        }
      })
      .catch(err => {
        console.error('Failed to load conversations:', err)
      })
      .finally(() => {
        if (isMounted) setLoadingList(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  /* ── Initial Load of Selected Conversation ──────────────────────── */
  useEffect(() => {
    if (!selectedId) return

    let isMounted = true
    chatApi
      .getConversation(selectedId)
      .then(({ data }) => {
        if (!isMounted) return
        setConversation(data)
        setMessages(data.messages || [])
        // Mark as near bottom and scroll immediately
        isNearBottomRef.current = true
        setHasNewScrolledUp(false)
        requestAnimationFrame(() => scrollToBottom('auto'))

        // Clear unread indicator for this conversation and update sidebar badge immediately
        setAllConversations(prev => prev.map(c => c.id === selectedId ? { ...c, unread_count: 0 } : c))
        window.dispatchEvent(new Event('messages-updated'))
      })
      .catch(err => {
        console.error('Failed to load conversation:', err)
      })

    return () => {
      isMounted = false
    }
  }, [selectedId, scrollToBottom])

  /* ── Silent Polling every 4s (Pauses when Tab Hidden or Offline) ── */
  useEffect(() => {
    let isMounted = true

    const runSilentPoll = async () => {
      // Pause if tab is hidden or offline
      if (document.hidden || !isOnline) return

      try {
        const promises = [chatApi.listConversations()]
        if (selectedId) {
          promises.push(chatApi.getConversation(selectedId))
        }

        const [convsRes, activeRes] = await Promise.all(promises)
        if (!isMounted) return

        // 1. Silent merge conversations (actively opened conversation has 0 unread)
        if (convsRes?.data) {
          const list = convsRes.data.map(c => c.id === selectedId ? { ...c, unread_count: 0 } : c)
          setAllConversations(prev => mergeConversations(prev, list))
        }

        // 2. Silent merge active conversation messages
        if (activeRes?.data) {
          const incomingConv = activeRes.data
          setConversation(prev => {
            if (!prev) return incomingConv
            if (prev.status !== incomingConv.status || prev.last_message_at !== incomingConv.last_message_at) {
              return { ...prev, ...incomingConv }
            }
            return prev
          })

          const incomingMsgs = incomingConv.messages || []
          setMessages(prev => {
            const merged = mergeMessages(prev, incomingMsgs)
            // If new messages arrived while user was scrolled up
            if (merged.length > prev.length) {
              const lastIncoming = merged[merged.length - 1]
              if (!isNearBottomRef.current && lastIncoming.sender_id !== user?.id) {
                setHasNewScrolledUp(true)
              }
            }
            return merged
          })
        }
      } catch {
        // Silent error during poll to prevent flicker
      }
    }

    if (isOnline) {
      runSilentPoll()
    }

    const interval = setInterval(() => {
      if (isOnline) runSilentPoll()
    }, 4000)

    const handleVisibilityChange = () => {
      if (!document.hidden && isOnline) {
        runSilentPoll()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      isMounted = false
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [selectedId, user?.id, isOnline])

  /* ── Conversation Selection ─────────────────────────────────────── */
  const handleSelectConversation = (id) => {
    if (id === selectedId) return
    setSelectedId(id)
    setDesktopMenuData(null)
    setEditingMsgId(null)
    setAllConversations(prev => prev.map(c => c.id === id ? { ...c, unread_count: 0 } : c))
    window.dispatchEvent(new Event('messages-updated'))
    navigate(`/clinic/messages?id=${id}`, { replace: true })
  }

  /* ── Send Message (Optimistic & Retry) ───────────────────────────── */
  const sendPendingMessage = async (msgToRetry) => {
    const targetClientId = msgToRetry.clientId || msgToRetry.id
    const targetText = msgToRetry.body
    if (!selectedId || !targetText) return

    setMessages(prev =>
      prev.map(m => (m.clientId === targetClientId || m.id === targetClientId ? { ...m, status: 'sending' } : m))
    )
    setSending(true)

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setMessages(prev =>
        prev.map(m => (m.clientId === targetClientId || m.id === targetClientId ? { ...m, status: 'failed' } : m))
      )
      setSending(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    try {
      const { data } = await chatApi.sendMessage(selectedId, targetText, targetClientId, {
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      setMessages(prev =>
        prev.map(m => (m.clientId === targetClientId || m.id === targetClientId ? { ...data.message, status: undefined } : m))
      )
      isNearBottomRef.current = true
      setHasNewScrolledUp(false)
      scrollToBottom('smooth')

      // Refresh conversations list in background
      chatApi.listConversations().then(res => {
        setAllConversations(prev => mergeConversations(prev, res.data || []))
      })
    } catch (err) {
      clearTimeout(timeoutId)
      setMessages(prev =>
        prev.map(m => (m.clientId === targetClientId || m.id === targetClientId ? { ...m, status: 'failed' } : m))
      )
    } finally {
      setSending(false)
    }
  }

  const handleRetry = (msg) => {
    sendPendingMessage(msg)
  }

  const handleRemoveOptimistic = (targetId) => {
    setMessages(prev => prev.filter(m => m.id !== targetId && m.clientId !== targetId))
  }

  const handleSendMessage = async (e) => {
    if (e) e.preventDefault()
    const text = inputText.trim()
    if (!text || sending || !selectedId) return

    // 2-second spam control
    const now = Date.now()
    if (now - lastSentAtRef.current < 2000) {
      return
    }
    lastSentAtRef.current = now

    const clientId = generateClientId()
    const optimisticMsg = {
      id: clientId,
      clientId,
      body: text,
      sender_id: user?.id,
      sender: { id: user?.id, name: user?.name, role: user?.role, avatar_url: user?.avatar_url },
      created_at: new Date().toISOString(),
      status: 'sending',
    }

    setInputText('')
    setMessages(prev => [...prev, optimisticMsg])
    isNearBottomRef.current = true
    setHasNewScrolledUp(false)
    scrollToBottom('smooth')

    sendPendingMessage(optimisticMsg)
  }

  // Auto-send pending/failed messages when back online
  useEffect(() => {
    if (isOnline) {
      const pending = (messagesRef.current || []).filter(m => m.status === 'failed')
      if (pending.length > 0) {
        ;(async () => {
          for (const m of pending) {
            await sendPendingMessage(m)
          }
        })()
      }
    }
  }, [isOnline])

  /* ── Touch Long-Press Handlers (Mobile) ─────────────────────────── */
  const handleTouchStart = (msg, e) => {
    if (e.touches.length !== 1) return
    const t = e.touches[0]
    touchStartRef.current = { x: t.clientX, y: t.clientY }
    setTouchHoldingMsgId(msg.id)
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current)
    touchTimerRef.current = setTimeout(() => {
      setTouchHoldingMsgId(null)
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
      setTouchHoldingMsgId(null)
    }
  }

  const handleTouchEnd = () => {
    if (touchTimerRef.current) {
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = null
    }
    touchStartRef.current = null
    setTouchHoldingMsgId(null)
  }

  /* ── Delete Message (with confirmation modal) ────────────── */
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
      setMessages(prev =>
        prev.map(m => m.id === msg.id ? { ...m, deleted_at: nowIso, body: null } : m)
      )
      toast.success('Message deleted.')
      setDeleteTargetMsg(null)
      chatApi.listConversations().then(res => {
        setAllConversations(prev => mergeConversations(prev, res.data || []))
      })
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete message.')
    } finally {
      setIsDeletingMessage(false)
    }
  }

  /* ── Inline Edit Message (Within 15 minutes with Rollback) ─── */
  const handleStartInlineEdit = (msg) => {
    setDesktopMenuData(null)
    setActionSheetMsg(null)
    setEditingMsgId(msg.id)
    setInlineEditText(msg.body || '')
  }

  const handleCancelInlineEdit = () => {
    setEditingMsgId(null)
    setInlineEditText('')
  }

  const handleSaveInlineEdit = async (msg) => {
    const trimmed = inlineEditText.trim()
    if (!trimmed || trimmed === msg.body || savingEdit) {
      setEditingMsgId(null)
      return
    }

    const prevBody = msg.body
    setSavingEdit(true)
    const nowIso = new Date().toISOString()
    setMessages(prev =>
      prev.map(m =>
        m.id === msg.id
          ? { ...m, body: trimmed, edited_at: nowIso }
          : m
      )
    )
    setEditingMsgId(null)
    setInlineEditText('')

    try {
      await chatApi.updateMessage(msg.id, trimmed)
      toast.success('Message updated.')

      chatApi.listConversations().then(res => {
        setAllConversations(prev => mergeConversations(prev, res.data || []))
      })
    } catch (err) {
      setMessages(prev =>
        prev.map(m =>
          m.id === msg.id
            ? { ...m, body: prevBody, edited_at: msg.edited_at }
            : m
        )
      )
      toast.error(err?.response?.data?.message || 'Failed to update message. Reverted.')
    } finally {
      setSavingEdit(false)
    }
  }

  /* ── Mark as resolved / Reopen ──────────────────────────────────── */
  const handleToggleStatus = async () => {
    if (!selectedId || !conversation || statusUpdating) return
    const newStatus = conversation.status === 'open' ? 'resolved' : 'open'
    setStatusUpdating(true)
    try {
      const { data } = await chatApi.updateStatus(selectedId, newStatus)
      setConversation(prev => ({ ...prev, status: data.status }))
      setAllConversations(prev =>
        prev.map(c => c.id === selectedId ? { ...c, status: data.status } : c)
      )
    } catch (err) {
      toast.error('Failed to update status.')
    } finally {
      setStatusUpdating(false)
    }
  }

  /* ── Filter Conversations for Active Tab ────────────────────────── */
  const openCount = allConversations.filter(c => c.status === 'open').length
  const resolvedCount = allConversations.filter(c => c.status === 'resolved').length
  const filteredConversations = allConversations.filter(c => c.status === activeTab)

  const [convPage, setConvPage] = useState(1)
  const [convPageSize, setConvPageSize] = useState(10)

  useEffect(() => {
    setConvPage(1)
  }, [activeTab])

  const convTotalPages = Math.max(1, Math.ceil(filteredConversations.length / convPageSize))
  const paginatedConversations = filteredConversations.slice((convPage - 1) * convPageSize, convPage * convPageSize)

  const messageItems = buildMessageItems(messages)
  const myStaffMsgs = messages.filter(m => m.sender_id === user?.id && !m.deleted_at && !m.status)
  const lastMyStaffMsg = myStaffMsgs[myStaffMsgs.length - 1]
  const isLastStaffSeen = !!(lastMyStaffMsg && lastMyStaffMsg.read_at)

  return (
    <DashboardLayout
      title="Messages"
      subtitle={`Student inquiries for ${user?.role === 'dentist' ? 'Dental Clinic' : 'Medical Clinic'}`}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '340px 1fr',
          gap: '1.25rem',
          height: 'calc(100vh - 175px)',
          minHeight: '520px',
        }}
      >
        {/* ═════════════════════════════════════════════════════════════
           COLUMN 1: CONVERSATION LIST (340px, full-height own scroll)
           ═════════════════════════════════════════════════════════════ */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--card, #ffffff)',
            borderRadius: 'var(--radius-md, 12px)',
            height: '100%',
          }}
        >
          {/* Tabs: Open / Resolved with Counts (Equal Size) */}
          <div
            style={{
              display: 'flex',
              padding: '0.65rem 0.75rem',
              gap: '0.5rem',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg, #f8fafc)',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('open')}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: 'none',
                borderRadius: 'var(--radius-sm, 8px)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                background: activeTab === 'open' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'open' ? '#ffffff' : 'var(--text-sub)',
                transition: 'all 0.15s ease',
                textAlign: 'center',
              }}
            >
              Open ({openCount})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('resolved')}
              style={{
                flex: 1,
                padding: '0.5rem',
                border: 'none',
                borderRadius: 'var(--radius-sm, 8px)',
                fontWeight: 600,
                fontSize: '0.85rem',
                cursor: 'pointer',
                background: activeTab === 'resolved' ? 'var(--accent)' : 'transparent',
                color: activeTab === 'resolved' ? '#ffffff' : 'var(--text-sub)',
                transition: 'all 0.15s ease',
                textAlign: 'center',
              }}
            >
              Resolved ({resolvedCount})
            </button>
          </div>

          {/* Conversation List Rows */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingList ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                Loading conversations...
              </div>
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: '2.5rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No {activeTab} conversations found.
              </div>
            ) : (
              paginatedConversations.map(c => {
                const isSelected = c.id === selectedId
                const student = c.student || {}
                const name = student.name || 'Student'
                // Show department for faculty/staff, grade/section for students
                const isFaculty = student.role === 'faculty_staff'
                const academic = isFaculty
                  ? (student.department || 'Faculty/Staff')
                  : ([student.grade_level, student.section].filter(Boolean).join(' · ') || 'Student')
                const lastSnippet = c.latest_message?.body || 'No messages'
                const timeText = formatMessageTime(c.last_message_at || c.updated_at)
                const hasUnread = !isSelected && (c.unread_count || 0) > 0

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectConversation(c.id)}
                    onMouseEnter={() => setHoveredConvId(c.id)}
                    onMouseLeave={() => setHoveredConvId(null)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.85rem 1rem',
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: isSelected
                        ? 'rgba(37, 99, 235, 0.08)'
                        : hoveredConvId === c.id
                        ? 'var(--bg, #f8fafc)'
                        : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                      transition: 'background 0.15s ease, border-color 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Student photo, or initials when none */}
                    <Avatar
                      src={student.avatar_url}
                      name={name}
                      size={40}
                      fallbackText={getInitials(name)}
                      style={{
                        background: isSelected ? 'var(--accent)' : '#e2e8f0',
                        color: isSelected ? '#ffffff' : '#334155',
                        fontWeight: 700,
                        fontSize: '0.82rem',
                        letterSpacing: '0.5px',
                      }}
                    />

                    {/* Middle Info Column */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '2px' }}>
                        <div
                          style={{
                            fontWeight: hasUnread ? 700 : 500,
                            fontSize: '0.88rem',
                            color: 'var(--text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                          {hasUnread && (
                            <span
                              style={{
                                width: '7px',
                                height: '7px',
                                borderRadius: '50%',
                                background: 'var(--accent, #2563eb)',
                                display: 'inline-block',
                                flexShrink: 0,
                              }}
                              title="Unread messages"
                            />
                          )}
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '6px' }}>
                          {timeText}
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: '0.74rem',
                          color: 'var(--text-sub)',
                          marginBottom: '3px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {academic}
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div
                          style={{
                            fontSize: '0.8rem',
                            color: hasUnread ? 'var(--text)' : 'var(--text-muted)',
                            fontWeight: hasUnread ? 600 : 400,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            flex: 1,
                          }}
                        >
                          {lastSnippet}
                        </div>
                        {hasUnread && (
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              display: 'inline-block',
                              marginLeft: '6px',
                              flexShrink: 0,
                            }}
                          />
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          <Pagination
            currentPage={convPage}
            totalPages={convTotalPages}
            totalItems={filteredConversations.length}
            pageSize={convPageSize}
            onPageChange={setConvPage}
            onPageSizeChange={(newSize) => {
              setConvPageSize(newSize)
              setConvPage(1)
            }}
            style={{ padding: '0.5rem 0.75rem', borderTop: '1px solid var(--border)' }}
          />
        </div>

        {/* ═════════════════════════════════════════════════════════════
           COLUMN 2: CHAT PANEL (full-height own scroll)
           ═════════════════════════════════════════════════════════════ */}
        <div
          className="card"
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'var(--card, #ffffff)',
            borderRadius: 'var(--radius-md, 12px)',
            height: '100%',
            position: 'relative',
          }}
        >
          {selectedId && conversation ? (
            <>
              {/* Chat Header */}
              <div
                style={{
                  padding: '0.85rem 1.25rem',
                  borderBottom: '1px solid var(--border)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  background: 'var(--bg, #f8fafc)',
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Avatar
                    src={conversation.student?.avatar_url}
                    name={conversation.student?.name}
                    size={40}
                    fallbackText={getInitials(conversation.student?.name)}
                    style={{ background: 'var(--accent)', color: '#ffffff', fontWeight: 700, fontSize: '0.85rem' }}
                  />
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.98rem', color: 'var(--text)' }}>
                        {conversation.student?.name || 'Student'}
                      </div>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.72rem',
                          padding: '0.15rem 0.5rem',
                          borderRadius: 'var(--radius-sm, 6px)',
                          background: conversation.status === 'open' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(148, 163, 184, 0.2)',
                          color: conversation.status === 'open' ? '#15803d' : 'var(--text-sub)',
                          fontWeight: 600,
                        }}
                      >
                        {conversation.status === 'open' ? 'Open' : 'Resolved'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-sub)', marginTop: '1px' }}>
                      {conversation.student?.role === 'faculty_staff'
                        ? (conversation.student?.department || 'Faculty/Staff')
                        : ([conversation.student?.grade_level, conversation.student?.section].filter(Boolean).join(' · ') || 'Student')}
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={statusUpdating}
                    style={{
                      padding: '0.45rem 0.85rem',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm, 6px)',
                      border: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: conversation.status === 'open' ? 'var(--card, #ffffff)' : 'var(--accent)',
                      color: conversation.status === 'open' ? 'var(--text)' : '#ffffff',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {conversation.status === 'open' ? 'Mark as resolved' : 'Reopen conversation'}
                  </button>
                </div>
              </div>

              {/* Internet Connection Offline Banner */}
              {!isOnline && (
                <div
                  style={{
                    padding: '0.45rem 1rem',
                    background: 'rgba(234, 179, 8, 0.15)',
                    borderBottom: '1px solid rgba(234, 179, 8, 0.3)',
                    fontSize: '0.78rem',
                    lineHeight: 1.4,
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    fontWeight: 500,
                    flexShrink: 0,
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

              {/* Messages Scroll Container */}
              <div
                ref={messagesScrollRef}
                onScroll={handleScroll}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '1.25rem',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3.5rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No messages yet in this conversation.
                  </div>
                ) : (
                  messageItems.map(item => {
                    if (item.type === 'separator') {
                      return (
                        <div
                          key={item.key}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '14px 0 8px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              color: 'var(--text-muted)',
                              background: 'var(--bg, #f1f5f9)',
                              padding: '3px 12px',
                              borderRadius: '9999px',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {item.label}
                          </span>
                        </div>
                      )
                    }

                    const m = item.msg
                    const isSending = m.status === 'sending'
                    const isFailed = m.status === 'failed'
                    const isStaffSender = (m.sender_id === user?.id)
                    const isRemoved = !!m.deleted_at
                    const isLastMine = isStaffSender && lastMyStaffMsg?.id === m.id && !isSending && !isFailed
                    const isEdited = !isRemoved && Boolean(m.edited_at)
                    const isBeingEdited = editingMsgId === m.id

                    return (
                      <div
                        key={item.key}
                        style={{
                          marginTop: item.spacingTop,
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: isStaffSender ? 'flex-end' : 'flex-start',
                          width: '100%',
                          boxSizing: 'border-box',
                        }}
                        onMouseEnter={() => setHoveredMsgId(m.id)}
                        onMouseLeave={() => setHoveredMsgId(null)}
                      >
                        {/* Student Name above first message in incoming run */}
                        {!isStaffSender && item.isFirstInRun && conversation.student?.name && !isRemoved && (
                          <div
                            style={{
                              fontSize: '0.72rem',
                              color: 'var(--text-muted)',
                              marginBottom: '2px',
                              paddingLeft: '4px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <Avatar
                              src={conversation.student.avatar_url}
                              name={conversation.student.name}
                              size={22}
                              fallbackText={getInitials(conversation.student.name)}
                              style={{ fontSize: '0.62rem' }}
                            />
                            {conversation.student.name}
                          </div>
                        )}

                        {/* Inline Edit Box OR Normal Message Bubble */}
                        {isBeingEdited ? (
                          <div
                            style={{
                              background: 'var(--bg-surface, #ffffff)',
                              border: '1.5px solid var(--accent)',
                              borderRadius: '12px',
                              padding: '8px 10px',
                              boxShadow: '0 2px 10px rgba(0, 0, 0, 0.08)',
                              width: '100%',
                              maxWidth: '420px',
                              boxSizing: 'border-box',
                            }}
                          >
                            <textarea
                              rows={2}
                              value={inlineEditText}
                              onChange={e => setInlineEditText(e.target.value)}
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
                                fontSize: '0.85rem',
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
                                disabled={savingEdit || !inlineEditText.trim() || inlineEditText.trim() === m.body}
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
                                {savingEdit ? 'Saving…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            className={`chat-msg-row ${isStaffSender ? 'own' : 'other'}`}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: isStaffSender ? 'flex-end' : 'flex-start',
                              gap: '8px',
                              width: '100%',
                              boxSizing: 'border-box',
                            }}
                          >
                            {/* Three-dot Button on LEFT of user's own message with 8px gap (shown on row hover/focus) */}
                            {isStaffSender && !isRemoved && !isSending && !isFailed && (
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
                              className={`chat-bubble ${isStaffSender ? 'user own-bubble' : 'bot'} ${touchHoldingMsgId === m.id ? 'is-holding' : ''}`}
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
                                background: isStaffSender ? 'var(--accent)' : 'var(--bg-surface, #f1f5f9)',
                                color: isStaffSender ? '#ffffff' : 'var(--text, #0f172a)',
                                border: isStaffSender ? 'none' : '1px solid var(--border, #e2e8f0)',
                                borderRadius: isStaffSender ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                                boxSizing: 'border-box',
                              }}
                              onContextMenu={isStaffSender && !isRemoved && !isSending && !isFailed ? e => e.preventDefault() : undefined}
                              onTouchStart={isStaffSender && !isRemoved && !isSending && !isFailed ? e => handleTouchStart(m, e) : undefined}
                              onTouchMove={isStaffSender && !isRemoved && !isSending && !isFailed ? handleTouchMove : undefined}
                              onTouchEnd={isStaffSender && !isRemoved && !isSending && !isFailed ? handleTouchEnd : undefined}
                              onTouchCancel={isStaffSender && !isRemoved && !isSending && !isFailed ? handleTouchEnd : undefined}
                            >
                              <div style={{ overflowWrap: 'break-word', wordBreak: 'normal', whiteSpace: 'pre-wrap' }}>
                                {isRemoved ? 'Message removed' : m.body}
                              </div>
                              <div
                                className="chat-bubble-meta"
                                style={{
                                  fontSize: '0.68rem',
                                  marginTop: '4px',
                                  opacity: isStaffSender ? 0.8 : 0.65,
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
                                    <span>{formatTimeOnly(m.created_at)}</span>
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

                        {/* Seen indicator under last staff message */}
                        {isLastMine && isLastStaffSeen && !isSending && !isFailed && (
                          <div
                            style={{
                              textAlign: 'right',
                              fontSize: '0.68rem',
                              color: 'var(--text-muted)',
                              marginTop: '2px',
                              paddingRight: '4px',
                            }}
                          >
                            Seen
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>

              {/* Floating "New messages" Pill Button */}
              {hasNewScrolledUp && (
                <button
                  type="button"
                  onClick={() => scrollToBottom('smooth')}
                  style={{
                    position: 'absolute',
                    bottom: '68px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    zIndex: 20,
                    background: 'var(--accent)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '9999px',
                    padding: '6px 16px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    boxShadow: '0 4px 14px rgba(0, 0, 0, 0.2)',
                    cursor: 'pointer',
                  }}
                >
                  New messages
                </button>
              )}

              {/* Input Area (Pinned at bottom, rounded, Enter sends, Shift+Enter newline, NO PLACEHOLDERS) */}
              <form
                onSubmit={handleSendMessage}
                style={{
                  display: 'flex',
                  padding: '0.75rem 1rem',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--card, #ffffff)',
                  gap: '0.5rem',
                  alignItems: 'flex-end',
                  flexShrink: 0,
                }}
              >
                <textarea
                  rows={1}
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSendMessage()
                    }
                  }}
                  maxLength={500}
                  disabled={sending}
                  className="chatbot-input"
                  style={{
                    flex: 1,
                    minHeight: '42px',
                    maxHeight: '120px',
                    resize: 'none',
                    borderRadius: '21px',
                    padding: '10px 16px',
                    boxSizing: 'border-box',
                    fontSize: '0.88rem',
                  }}
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={sending || !inputText.trim()}
                  className="chatbot-send-btn"
                  style={{
                    height: '42px',
                    minHeight: '42px',
                    width: 'auto',
                    padding: '0 1.25rem',
                    borderRadius: '21px',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </form>
            </>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
              }}
            >
              Select a conversation to view messages.
            </div>
          )}
        </div>
      </div>

      {/* ── Desktop Action Menu (Rendered via Portal, high z-index) ──── */}
      <DesktopActionMenu
        message={desktopMenuData?.message}
        anchorRect={desktopMenuData?.anchorRect}
        isOpen={Boolean(desktopMenuData)}
        onClose={() => setDesktopMenuData(null)}
        onEdit={(m) => handleStartInlineEdit(m)}
        onDelete={(m) => handleRequestDelete(m)}
      />

      {/* ── Touch Bottom Sheet (Rendered via Portal, high z-index) ──── */}
      <MessageActionSheet
        message={actionSheetMsg}
        onClose={() => setActionSheetMsg(null)}
        onEdit={(m) => handleStartInlineEdit(m)}
        onDelete={(m) => handleRequestDelete(m)}
      />

      {/* ── Confirmation Modal before deleting message ──── */}
      <DeleteMessageModal
        isOpen={Boolean(deleteTargetMsg)}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        isDeleting={isDeletingMessage}
      />
    </DashboardLayout>
  )
}
