import { useEffect, useState, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import EventDetailsModal from '../components/EventDetailsModal'
import Dropdown from '../components/Dropdown'
import { notificationsApi } from '../api/notifications'
import { useAuth } from '../context/AuthContext'
import { useChatbot } from '../context/ChatbotContext'
import {
  formatNotificationTime,
  isAnnouncementItem,
  isAppointmentItem,
  getAppointmentTargetUrl
} from '../utils/notificationHelpers'

function AnnouncementModal({ onClose, onBroadcast }) {
  const [form, setForm]       = useState({ title: '', message: '', type: 'info' })
  const [saving, setSaving]   = useState(false)
  const [errors, setErrors]   = useState({})

  const set = (k, v) => { setForm(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })) }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})
    try {
      const { data } = await notificationsApi.announce(form)
      toast.success(data.message || 'Announcement broadcasted.')
      window.dispatchEvent(new Event('notifications-updated'))
      onBroadcast()
    } catch (err) {
      const d = err?.response?.data
      if (d?.errors) {
        const flat = {}
        Object.entries(d.errors).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? v[0] : v })
        setErrors(flat)
      } else {
        toast.error(d?.message || 'Failed to broadcast announcement.')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>Send Clinic Announcement</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <p className="text-muted">This announcement will be broadcasted to all active users' in-app notification centers immediately.</p>
          <div className="form-group">
            <label>Announcement Title</label>
            <input value={form.title} onChange={e => set('title', e.target.value)}
              placeholder="e.g. Scheduled Maintenance, Influenza Vaccination Drive"
              className={errors.title ? 'input-error' : ''} required />
            {errors.title && <span className="field-error">{errors.title}</span>}
          </div>
          <div className="form-group">
            <label>Announcement Body</label>
            <textarea value={form.message} onChange={e => set('message', e.target.value)}
              placeholder="Provide detailed description of the announcement..."
              className={errors.message ? 'input-error' : ''} rows={4} required />
            {errors.message && <span className="field-error">{errors.message}</span>}
          </div>
          <div className="form-group">
            <label>Announcement Alert Level</label>
            <Dropdown
              ariaLabel="Announcement alert level"
              value={form.type}
              onChange={v => set('type', v)}
              options={[
                { value: 'info', label: 'Info (Blue)' },
                { value: 'success', label: 'Success (Green)' },
                { value: 'warning', label: 'Warning (Yellow)' },
                { value: 'error', label: 'Alert / Urgent (Red)' },
              ]}
            />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : 'Broadcast Announcement'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DeleteConfirmModal({ notification, onClose, onConfirm, deleting }) {
  if (!notification) return null

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <h2>Delete Notification</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: '0.92rem', color: 'var(--text)', lineHeight: 1.5 }}>
            Are you sure you want to delete this notification? This will only remove it from your notification list and will not affect any announcements for other users.
          </p>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn-ghost" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary"
            style={{ background: 'var(--red, #ef4444)', borderColor: 'var(--red, #ef4444)' }}
            disabled={deleting}
            onClick={onConfirm}
          >
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Helper to group notifications by date
function groupByDate(items) {
  const today = new Date().toLocaleDateString()
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString()

  const grouped = {
    today: [],
    yesterday: [],
    earlier: [],
  }

  items.forEach(item => {
    const itemDate = new Date(item.created_at).toLocaleDateString()
    if (itemDate === today) grouped.today.push(item)
    else if (itemDate === yesterday) grouped.yesterday.push(item)
    else grouped.earlier.push(item)
  })

  return grouped.today.length > 0 || grouped.yesterday.length > 0 || grouped.earlier.length > 0
    ? grouped
    : null
}

export default function NotificationsPage() {
  const { user } = useAuth()
  const { openLiveChat } = useChatbot()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const allowedTabs = ['all', 'announcements', 'appointments']
  const paramTab = searchParams.get('tab')
  const initialTab = allowedTabs.includes(paramTab) ? paramTab : 'all'

  const [activeTab, setActiveTab]                     = useState(initialTab)
  const [notifications, setNotifications]             = useState([])
  const [loading, setLoading]                         = useState(true)
  const [announceModal, setAnnounceModal]             = useState(false)
  const [selectedAnnouncement, setSelectedAnnouncement] = useState(null)
  const [deleteTarget, setDeleteTarget]               = useState(null)
  const [deleting, setDeleting]                       = useState(false)
  const [openMenuId, setOpenMenuId]                   = useState(null)
  const menuContainerRef = useRef(null)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await notificationsApi.list()
      const isStaff = ['clinic_staff', 'nurse', 'dentist'].includes(user?.role)
      const list = (data?.notifications || []).filter(n => {
        if (!isStaff) return true
        const isChatNotif = n.target_type === 'conversation' ||
          n.action_url?.includes('/clinic/messages') ||
          n.title?.startsWith('New message from')
        return !isChatNotif
      })
      setNotifications(list)
    } catch {
      toast.error('Failed to load notifications.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const handleUpdate = () => load()
    window.addEventListener('notifications-updated', handleUpdate)
    return () => {
      window.removeEventListener('notifications-updated', handleUpdate)
    }
  }, [])

  // Close three-dot menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (menuContainerRef.current && !menuContainerRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const handleTabChange = (tab) => {
    setActiveTab(tab)
    setSearchParams(tab === 'all' ? {} : { tab })
  }

  // Filter lists
  const announcementItems = notifications.filter(n => isAnnouncementItem(n))
  const appointmentItems  = notifications.filter(n => isAppointmentItem(n))

  // Unread counts per tab
  const allUnread           = notifications.filter(n => !n.is_read).length
  const announcementsUnread = announcementItems.filter(n => !n.is_read).length
  const appointmentsUnread  = appointmentItems.filter(n => !n.is_read).length

  // Determine current tab list
  let currentList = notifications
  if (activeTab === 'announcements') currentList = announcementItems
  if (activeTab === 'appointments')  currentList = appointmentItems

  // Sort: Unread first, then newest first
  const sortedList = [...currentList].sort((a, b) => {
    if (a.is_read === b.is_read) {
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    }
    return a.is_read ? 1 : -1
  })

  const handleReadAll = async () => {
    try {
      await notificationsApi.readAll()
      setNotifications(p => p.map(n => ({ ...n, is_read: true })))
      window.dispatchEvent(new Event('notifications-updated'))
      toast.success('All notifications marked as read.')
    } catch {
      toast.error('Failed to mark all as read.')
    }
  }

  const handleToggleRead = async (notif) => {
    try {
      if (notif.is_read) {
        await notificationsApi.unread(notif.id)
        setNotifications(p => p.map(n => n.id === notif.id ? { ...n, is_read: false } : n))
        window.dispatchEvent(new Event('notifications-updated'))
        toast.success('Marked as unread.')
      } else {
        await notificationsApi.read(notif.id)
        setNotifications(p => p.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
        window.dispatchEvent(new Event('notifications-updated'))
        toast.success('Marked as read.')
      }
    } catch {
      toast.error('Failed to update status.')
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await notificationsApi.delete(deleteTarget.id)
      setNotifications(p => p.filter(n => n.id !== deleteTarget.id))
      window.dispatchEvent(new Event('notifications-updated'))
      toast.success('Notification deleted.')
      setDeleteTarget(null)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete notification.')
    } finally {
      setDeleting(false)
    }
  }

  const handleNotificationClick = async (notif) => {
    // Automatically mark as read if currently unread
    if (!notif.is_read) {
      try {
        await notificationsApi.read(notif.id)
        setNotifications(p => p.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
        window.dispatchEvent(new Event('notifications-updated'))
      } catch {}
    }

    // 1. Announcements / Events open modal
    if (isAnnouncementItem(notif)) {
      setSelectedAnnouncement(notif)
      return
    }

    // 2. Appointment notifications navigate to role appointments page with status & highlight
    if (isAppointmentItem(notif)) {
      const targetUrl = getAppointmentTargetUrl(notif, user?.role)
      navigate(targetUrl)
      return
    }

    // 3. Live chat conversation
    if (notif.target_type === 'conversation' || notif.action_url?.includes('chat=')) {
      if (user?.role === 'student' || user?.role === 'faculty_staff') {
        const match = notif.action_url?.match(/chat=(nurse|dentist)/)
        const role = match ? match[1] : 'nurse'
        openLiveChat(role)
        return
      }
    }

    // 4. Fallback to action_url if defined
    if (notif.action_url) {
      navigate(notif.action_url)
    }
  }

  const canAnnounce = ['admin', 'clinic_staff'].includes(user?.role)

  const emptyMessages = {
    all: 'No notifications found.',
    announcements: 'No announcements found.',
    appointments: 'No appointment notifications found.',
  }

  return (
    <DashboardLayout
      title="Notification Center"
      subtitle="View system messages, appointments, and clinic updates."
    >
      {/* ── Fixed Toolbar with Tabs ──────────────────────────────────────── */}
      <div>
        {/* Tabs Row */}
        <div style={{ display: 'flex', gap: 'clamp(1rem, 3vw, 2rem)', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', minHeight: '44px', alignItems: 'center' }}>
          {[
            { id: 'all',           label: 'All',           unread: allUnread },
            { id: 'announcements', label: 'Announcements', unread: announcementsUnread },
            { id: 'appointments',  label: 'Appointments',  unread: appointmentsUnread },
          ].map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => handleTabChange(tab.id)}
              style={{
                padding: '0 0.5rem',
                fontSize: 'clamp(0.875rem, 2.5vw, 0.9rem)',
                fontWeight: activeTab === tab.id ? 600 : 400,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : 'none',
                color: activeTab === tab.id ? 'var(--text)' : 'var(--text-muted)',
                cursor: 'pointer',
                transition: 'all var(--transition)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                minHeight: '44px',
                minWidth: '44px',
                whiteSpace: 'nowrap',
              }}
            >
              <span>{tab.label}</span>
              {tab.unread > 0 && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: 'var(--accent)',
                  }}
                  title={`${tab.unread} unread`}
                >
                  {tab.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Scrollable List with Cards and Date Groups ──────────────── */}
      <div ref={menuContainerRef}>
        {loading ? (
          <div className="table-loading"><span className="loader-ring" /></div>
        ) : sortedList.length === 0 ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center', color: 'var(--text-muted)', background: '#ffffff', borderRadius: '12px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✓</div>
            <p style={{ fontSize: '0.95rem', margin: 0 }}>
              {emptyMessages[activeTab] || 'No notifications in this tab.'}
            </p>
            <p style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>You're all caught up</p>
          </div>
        ) : (
          <div>
            {groupByDate(sortedList) && Object.entries(groupByDate(sortedList)).map(([dateGroup, items], groupIndex) => (
              items.length > 0 && (
                <div key={dateGroup}>
                  {/* Date Group Header with "Mark all as read" and Broadcast on first group */}
                  <div style={{ 
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: groupIndex === 0 ? '0.75rem' : '0.75rem',
                    marginBottom: '0.5rem',
                    paddingLeft: '0.5rem',
                    paddingRight: '0.5rem',
                  }}>
                    <div style={{
                      fontSize: 'clamp(0.75rem, 2vw, 0.8rem)', 
                      fontWeight: 700, 
                      textTransform: 'uppercase', 
                      color: 'var(--text-muted)',
                    }}>
                      {dateGroup === 'today' ? 'TODAY' : dateGroup === 'yesterday' ? 'YESTERDAY' : 'EARLIER'}
                    </div>

                    {/* Show action buttons only on first group */}
                    {groupIndex === 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto' }}>
                        {allUnread > 0 && (
                          <button
                            type="button"
                            onClick={handleReadAll}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--accent)',
                              fontSize: 'clamp(0.75rem, 2vw, 0.8rem)',
                              fontWeight: 600,
                              cursor: 'pointer',
                              padding: '0.35rem 0.5rem',
                              minHeight: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Mark all as read
                          </button>
                        )}
                        {canAnnounce && (
                          <button
                            onClick={() => setAnnounceModal(true)}
                            style={{
                              padding: '0.35rem 0.5rem',
                              fontSize: 'clamp(0.7rem, 1.8vw, 0.75rem)',
                              fontWeight: 600,
                              background: 'none',
                              border: '1px solid var(--accent)',
                              color: 'var(--accent)',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer',
                              minHeight: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            Broadcast
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Notification Cards */}
                  {items.map((n) => (
                    <div
                      key={n.id}
                      style={{
                        background: n.is_read ? '#ffffff' : '#f5f9ff',
                        border: n.is_read ? '1px solid var(--border)' : '1px solid rgba(59, 130, 246, 0.3)',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        marginBottom: '10px',
                        cursor: 'pointer',
                        transition: 'all var(--transition)',
                        minHeight: '44px',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '0.65rem',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.borderColor = n.is_read ? 'rgba(107, 114, 128, 0.5)' : 'rgba(59, 130, 246, 0.5)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.borderColor = n.is_read ? 'var(--border)' : 'rgba(59, 130, 246, 0.3)'
                      }}
                      onClick={() => handleNotificationClick(n)}
                    >
                      {/* Left: Unread Dot + Content */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', minWidth: 0, flex: 1 }}>
                        {/* Unread Dot (8px, only if unread) */}
                        {!n.is_read && (
                          <div
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              marginTop: '0.4rem',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        {n.is_read && (
                          <div style={{ width: '8px', flexShrink: 0 }} />
                        )}

                        {/* Title and Message */}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <h4
                            style={{
                              fontSize: 'clamp(0.875rem, 2.5vw, 0.9375rem)',
                              fontWeight: n.is_read ? 400 : 600,
                              color: n.is_read ? '#334155' : 'var(--text)',
                              margin: '0 0 0.25rem 0',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {n.title}
                          </h4>
                          <p
                            style={{
                              fontSize: 'clamp(0.8125rem, 2vw, 0.85rem)',
                              color: n.is_read ? '#64748b' : 'var(--text-muted)',
                              margin: 0,
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                              overflow: 'hidden',
                              lineHeight: 1.4,
                            }}
                          >
                            {n.message}
                          </p>
                          {/* Timestamp on mobile (under message) */}
                          <div style={{ fontSize: 'clamp(0.75rem, 1.5vw, 0.8rem)', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                            {formatNotificationTime(n.created_at)}
                          </div>
                        </div>
                      </div>

                      {/* Right: Menu Button */}
                      <div
                        style={{ position: 'relative' }}
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '1.1rem',
                            lineHeight: 1,
                            padding: '0.25rem 0.35rem',
                            cursor: 'pointer',
                            minHeight: '44px',
                            minWidth: '44px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            setOpenMenuId(openMenuId === n.id ? null : n.id)
                          }}
                          title="Options"
                          aria-label="Options"
                        >
                          ⋯
                        </button>

                        {openMenuId === n.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              marginTop: '0.25rem',
                              background: '#ffffff',
                              border: '1px solid var(--border)',
                              borderRadius: 'var(--radius-sm)',
                              boxShadow: 'var(--shadow-md)',
                              zIndex: 50,
                              minWidth: '135px',
                              overflow: 'hidden',
                            }}
                          >
                            <button
                              type="button"
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.5rem 0.85rem',
                                fontSize: '0.82rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--text)',
                                cursor: 'pointer',
                                minHeight: '44px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(null)
                                handleToggleRead(n)
                              }}
                            >
                              {n.is_read ? 'Mark as unread' : 'Mark as read'}
                            </button>
                            <div style={{ height: '1px', background: 'var(--border)' }} />
                            <button
                              type="button"
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '0.5rem 0.85rem',
                                fontSize: '0.82rem',
                                background: 'none',
                                border: 'none',
                                color: 'var(--red)',
                                cursor: 'pointer',
                                minHeight: '44px',
                                display: 'flex',
                                alignItems: 'center',
                              }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setOpenMenuId(null)
                                setDeleteTarget(n)
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            ))}
          </div>
        )}
      </div>

      {/* ── Modals ────────────────────────────────────────────── */}
      {selectedAnnouncement && (
        <EventDetailsModal
          notification={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}

      {announceModal && (
        <AnnouncementModal
          onClose={() => setAnnounceModal(false)}
          onBroadcast={() => { setAnnounceModal(false); load() }}
        />
      )}

      {deleteTarget && (
        <DeleteConfirmModal
          notification={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
          deleting={deleting}
        />
      )}
    </DashboardLayout>
  )
}
