import { useEffect, useState, useRef } from 'react'
import { toast } from 'react-hot-toast'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../components/DashboardLayout'
import EventDetailsModal from '../components/EventDetailsModal'
import Pagination from '../components/Pagination'
import { notificationsApi } from '../api/notifications'
import { useAuth } from '../context/AuthContext'
import { useChatbot } from '../context/ChatbotContext'
import {
  formatNotificationTime,
  isAnnouncementItem,
  isAppointmentItem,
  getAppointmentTargetUrl
} from '../utils/notificationHelpers'

const NOTIFICATION_THEMES = {
  info:    { bg: 'rgba(137,180,250,0.08)', border: '1px solid rgba(137,180,250,0.18)', badge: 'status-badge role-blue', label: 'Info' },
  success: { bg: 'rgba(166,227,161,0.08)', border: '1px solid rgba(166,227,161,0.18)', badge: 'status-badge active', label: 'Success' },
  warning: { bg: 'rgba(249,226,175,0.08)', border: '1px solid rgba(249,226,175,0.18)', badge: 'status-badge role-gold', label: 'Warning' },
  error:   { bg: 'rgba(243,139,168,0.08)', border: '1px solid rgba(243,139,168,0.18)', badge: 'status-badge danger', label: 'Alert' },
}

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
            <select value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="info">Info (Blue)</option>
              <option value="success">Success (Green)</option>
              <option value="warning">Warning (Yellow)</option>
              <option value="error">Alert / Urgent (Red)</option>
            </select>
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
  const [currentPage, setCurrentPage]                 = useState(1)
  const [pageSize, setPageSize]                       = useState(10)
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
    setCurrentPage(1)
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

  // Pagination
  const totalPages = Math.max(1, Math.ceil(sortedList.length / pageSize))
  const paginatedList = sortedList.slice((currentPage - 1) * pageSize, currentPage * pageSize)

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
      if (user?.role === 'student') {
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
      {/* ── Toolbar: Tabs & Actions ─────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        {/* Tabs: All | Announcements | Appointments */}
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
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
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.45rem',
                padding: '0.45rem 0.95rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                cursor: 'pointer',
                background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                color: activeTab === tab.id ? '#ffffff' : 'var(--text-sub)',
                transition: 'all var(--transition)',
              }}
            >
              <span>{tab.label}</span>
              {tab.unread > 0 && (
                <span
                  style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.45rem',
                    borderRadius: '999px',
                    background: activeTab === tab.id ? 'rgba(255,255,255,0.3)' : 'var(--accent)',
                    color: '#ffffff',
                  }}
                  title={`${tab.unread} unread`}
                >
                  {tab.unread}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Toolbar Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
          {allUnread > 0 && (
            <button
              type="button"
              className="btn-ghost"
              style={{ border: '1px solid var(--border)', fontSize: '0.825rem', padding: '0.45rem 0.85rem' }}
              onClick={handleReadAll}
            >
              Mark all as read
            </button>
          )}
          {canAnnounce && (
            <button className="btn-primary" onClick={() => setAnnounceModal(true)}>
              Broadcast Announcement
            </button>
          )}
        </div>
      </div>

      {/* ── Main Notification List ──────────────────────────────── */}
      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : sortedList.length === 0 ? (
        <div
          className="empty-state"
          style={{
            padding: '3.5rem 1.5rem',
            background: '#ffffff',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)',
            textAlign: 'center',
          }}
        >
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
            {emptyMessages[activeTab] || 'No notifications in this tab.'}
          </p>
        </div>
      ) : (
        <div className="unavail-list" ref={menuContainerRef}>
          {paginatedList.map(n => {
            const theme = NOTIFICATION_THEMES[n.type] || NOTIFICATION_THEMES.info
            const isAnn = isAnnouncementItem(n)
            const isAppt = isAppointmentItem(n)

            return (
              <div
                key={n.id}
                className={`unavail-card ${n.is_read ? 'read' : 'unread'}`}
                style={{
                  background: theme.bg,
                  border: theme.border,
                  borderLeft: `4px solid ${n.is_read ? 'var(--border)' : 'var(--accent)'}`,
                  opacity: n.is_read ? 0.78 : 1,
                  transition: 'background var(--transition), opacity var(--transition)',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-md)',
                  padding: '1rem 1.15rem',
                  marginBottom: '0.75rem',
                  position: 'relative',
                }}
                onClick={() => handleNotificationClick(n)}
              >
                <div style={{ width: '100%' }}>
                  {/* Card Header: Badges, Title, Blue Dot, Three-dot Menu */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'nowrap' }}>
                    <span className={theme.badge} style={{ flexShrink: 0 }}>
                      {theme.label}
                    </span>

                    {isAnn && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: '#e0e7ff',
                          color: '#3730a3',
                          flexShrink: 0,
                        }}
                      >
                        Announcement
                      </span>
                    )}

                    {isAppt && !isAnn && (
                      <span
                        style={{
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          padding: '0.15rem 0.5rem',
                          borderRadius: '4px',
                          background: '#ecfdf5',
                          color: '#065f46',
                          flexShrink: 0,
                        }}
                      >
                        Appointment
                      </span>
                    )}

                    <h3
                      style={{
                        fontSize: '0.93rem',
                        fontWeight: 700,
                        color: n.is_read ? 'var(--text-sub)' : 'var(--text)',
                        margin: 0,
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {n.title}
                    </h3>

                    {/* Unread Blue Dot */}
                    {!n.is_read && (
                      <span
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          background: 'var(--accent, #3b82f6)',
                          display: 'inline-block',
                          flexShrink: 0,
                        }}
                        title="Unread"
                      />
                    )}

                    {/* Three-Dot Menu Button */}
                    <div
                      style={{ position: 'relative', marginLeft: '0.4rem', flexShrink: 0 }}
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          fontSize: '1.25rem',
                          lineHeight: 1,
                          padding: '0.2rem 0.45rem',
                          borderRadius: 'var(--radius-sm)',
                          cursor: 'pointer',
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
                            boxShadow: 'var(--shadow-md, 0 4px 12px rgba(0,0,0,0.12))',
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
                              padding: '0.55rem 0.85rem',
                              fontSize: '0.825rem',
                              fontWeight: 500,
                              background: 'none',
                              border: 'none',
                              color: 'var(--text)',
                              cursor: 'pointer',
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
                              padding: '0.55rem 0.85rem',
                              fontSize: '0.825rem',
                              fontWeight: 500,
                              background: 'none',
                              border: 'none',
                              color: 'var(--red, #ef4444)',
                              cursor: 'pointer',
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

                  {/* Message (Limited to 2 lines preview) */}
                  <p
                    style={{
                      color: 'var(--text-sub)',
                      fontSize: '0.86rem',
                      marginTop: '0.45rem',
                      marginBottom: '0.45rem',
                      lineHeight: '1.45',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {n.message}
                  </p>

                  {/* Card Footer: Relative Timestamp and Hint */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.45rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    <span>{formatNotificationTime(n.created_at)}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>
                      {isAnn ? 'View Details' : (isAppt ? 'View Appointment' : 'View')}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}

          {/* ── Pagination ─────────────────────────────────────────── */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={sortedList.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize)
              setCurrentPage(1)
            }}
          />
        </div>
      )}

      {/* ── Modals ────────────────────────────────────────────── */}
      {/* 1. Announcement / Event Detail Modal */}
      {selectedAnnouncement && (
        <EventDetailsModal
          notification={selectedAnnouncement}
          onClose={() => setSelectedAnnouncement(null)}
        />
      )}

      {/* 2. Broadcast Announcement Modal (Admin / Clinic Staff) */}
      {announceModal && (
        <AnnouncementModal
          onClose={() => setAnnounceModal(false)}
          onBroadcast={() => { setAnnounceModal(false); load() }}
        />
      )}

      {/* 3. Delete Confirmation Modal */}
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
