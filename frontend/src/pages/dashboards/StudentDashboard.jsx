import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { dashboardApi } from '../../api/dashboard'
import { useAuth } from '../../context/AuthContext'
import { CardFallback } from '../../components/dashboard/Fallbacks'
import { formatAppointmentDate, formatAppointmentTime } from '../../utils/dateUtils'
import { EMPTY } from '../../utils/emptyValue'

const CalendarWidget = lazy(() => import('../../components/CalendarWidget'))

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const CalendarIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const ClockIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const STATUS_MAP = {
  pending:   { label: 'Pending',   cls: 'pending' },
  confirmed: { label: 'Confirmed', cls: 'confirmed' },
  completed: { label: 'Completed', cls: 'completed' },
  cancelled: { label: 'Cancelled', cls: 'cancelled' },
}

export default function StudentDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // ONE request for the whole dashboard: counts, appointments, notifications, announcements and calendar events
  const load = useCallback(async () => {
    try {
      const res = await dashboardApi.student()
      setData(res.data)
    } catch (e) {
      console.error('Failed to load dashboard', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    // an announcement was posted or removed in this browser: reload
    window.addEventListener('announcements-updated', load)
    return () => window.removeEventListener('announcements-updated', load)
  }, [load])

  const appointments = data?.appointments ?? []
  const unread = data?.stats?.unread_notifications ?? 0
  const notifs = (() => {
    const unique = []
    const seen = new Set()
    for (const notif of (data?.notifications ?? [])) {
      if (!seen.has(notif.created_at)) {
        seen.add(notif.created_at)
        unique.push(notif)
      }
    }
    return unique
  })()

  const upcomingAppts = appointments.filter(a => a.status === 'pending' || a.status === 'confirmed').sort((a,b) => new Date(a.scheduled_at || a.appointment_date || 0) - new Date(b.scheduled_at || b.appointment_date || 0))
  const completedAppts = appointments.filter(a => a.status === 'completed').sort((a,b) => new Date(b.scheduled_at || b.appointment_date || 0) - new Date(a.scheduled_at || a.appointment_date || 0))
  const nextAppointment = upcomingAppts[0]
  
  const recentNotifs  = notifs.slice(0, 4)

  // announcementsList comes directly from the DB /api/announcements endpoint
  // (already filtered by audience for this user's role on the backend)
  const displayAnnouncements = data?.announcements ?? []

  const stats = [
    { value: loading ? EMPTY : (data?.stats?.upcoming_appointments ?? 0), label: 'Upcoming Appointments', icon: 'appointments' },
    { value: loading ? EMPTY : (data?.stats?.completed_visits ?? 0), label: 'Completed Visits',      icon: 'myRecords' },
    { value: loading ? EMPTY : unread,               label: 'Unread Notifications',  icon: 'notifications' },
  ]

  return (
    <DashboardLayout
      title="Student Dashboard"
      subtitle="Your health, your records — all in one place."
      stats={stats}
    >
      <div className="dashboard-main-grid">
        
        {/* ── Main Column ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Upcoming Appointment */}
          <div className="data-table-wrap">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Upcoming Appointment</span>
              {nextAppointment && (
                <Link to="/appointments" style={{ fontSize: '0.775rem', color: 'var(--accent)', fontWeight: 600 }}>
                  Manage Appointments
                </Link>
              )}
            </div>
            {loading ? (
              <div className="table-loading"><div className="loader-ring" /></div>
            ) : nextAppointment ? (
              <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text)', marginBottom: '0.35rem' }}>
                    {nextAppointment.clinic_service?.name || nextAppointment.service?.name || 'General Consultation'}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <CalendarIcon size={15} />
                      {formatAppointmentDate(nextAppointment)}
                    </span>
                    <span style={{ color: 'var(--border)' }}>·</span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
                      <ClockIcon size={15} />
                      {formatAppointmentTime(nextAppointment)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Provider: {nextAppointment.staff?.name || 'Assigned Clinic Practitioner'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <span className={`status-badge ${STATUS_MAP[nextAppointment.status]?.cls || 'pending'}`}>
                    {STATUS_MAP[nextAppointment.status]?.label || nextAppointment.status}
                  </span>
                  <Link to="/appointments" className="btn-secondary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.785rem' }}>
                    View Details
                  </Link>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '1.75rem', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }}>You have no upcoming clinic appointments.</p>
                <Link to="/appointments" className="btn-primary" style={{ display: 'inline-flex', padding: '0.45rem 0.95rem', fontSize: '0.825rem' }}>
                  Book Appointment Now
                </Link>
              </div>
            )}
          </div>

          {/* Clinic Announcements */}
          <div className="data-table-wrap">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Clinic Announcements</span>
                <span style={{ fontSize: '0.72rem', background: '#dbeafe', color: '#1e40af', padding: '0.15rem 0.5rem', borderRadius: '999px', fontWeight: 600 }}>
                  Active Updates
                </span>
              </div>
              <Link to="/notifications?tab=announcements" style={{ fontSize: '0.775rem', color: 'var(--accent)', fontWeight: 600 }}>
                View All Announcements
              </Link>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {displayAnnouncements.map(ann => (
                <div key={ann.id} style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', marginBottom: '0.35rem', flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span className="status-badge role-blue" style={{ fontSize: '0.7rem', padding: '0.15rem 0.45rem' }}>
                        {ann.audience || 'Announcement'}
                      </span>
                      <span style={{ fontWeight: 600, fontSize: '0.885rem', color: 'var(--text)' }}>
                        {ann.title}
                      </span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {ann.created_at ? new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.825rem', color: 'var(--text-sub)', margin: 0, lineHeight: 1.45 }}>
                    {ann.message}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Access */}
          <div>
            <p className="quick-links-section-title">Quick Access</p>
            <div className="quick-links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
              {[
                { to: '/appointments', label: 'Book Appointment', desc: 'Schedule a new medical or dental visit', icon: 'M8 2v4M16 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z' },
                { to: '/my-records',   label: 'My Health Records', desc: 'View past consultation records & vitals', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
              ].map(link => (
                <Link key={link.to} to={link.to} className="quick-link-card">
                  <div className="quick-link-icon"><Icon d={link.icon} size={20} /></div>
                  <div className="quick-link-info">
                    <span className="quick-link-label">{link.label}</span>
                    <span className="quick-link-desc">{link.desc}</span>
                  </div>
                  <span className="quick-link-arrow"><Icon d="M9 18l6-6-6-6" size={16} /></span>
                </Link>
              ))}
            </div>
          </div>

          {/* My Appointments Table */}
          <div className="data-table-wrap">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>My Appointments</span>
              <Link to="/appointments" style={{ fontSize: '0.775rem', color: 'var(--accent)', fontWeight: 600 }}>Book / Manage</Link>
            </div>
            {loading ? (
              <div className="table-loading"><div className="loader-ring" /></div>
            ) : (upcomingAppts.length === 0 && completedAppts.length === 0) ? (
              <div className="empty-state">
                <p>No appointments booked yet.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead><tr><th>Date</th><th>Service</th><th>Staff / Provider</th><th>Status</th></tr></thead>
                <tbody>
                  {[...upcomingAppts, ...completedAppts].slice(0, 5).map(a => {
                    const s = STATUS_MAP[a.status] || { label: a.status, cls: 'pending' }
                    return (
                      <tr key={a.id}>
                        <td data-label="Date" style={{ fontSize: '0.8rem', color: 'var(--text-sub)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {formatAppointmentDate(a)}
                        </td>
                        <td data-label="Service" className="td-name">{a.clinic_service?.name || a.service?.name || EMPTY}</td>
                        <td data-label="Staff / Provider" style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.staff?.name || 'Assigned Staff'}</td>
                        <td data-label="Status"><span className={`status-badge ${s.cls}`}>{s.label}</span></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

        </div>

        {/* ── Right Column ───────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          <Suspense fallback={<CardFallback />}>
            <CalendarWidget appointments={appointments} userRole={user?.role} events={data?.calendar_events ?? []} />
          </Suspense>
          
          <div className="data-table-wrap">
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Recent Notifications</span>
              <Link to="/notifications" style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>View all</Link>
            </div>
            {loading ? (
              <div className="table-loading"><div className="loader-ring" /></div>
            ) : recentNotifs.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem' }}><p>No new notifications.</p></div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {recentNotifs.map(n => (
                  <div key={n.id} style={{ padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0.65rem', alignItems: 'flex-start' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: n.read_at ? 'var(--border)' : 'var(--accent)', flexShrink: 0, marginTop: '0.4rem' }} />
                    <div>
                      <div style={{ fontSize: '0.8rem', fontWeight: n.read_at ? 400 : 600, color: 'var(--text)', lineHeight: 1.4 }}>{n.title || n.message}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        {n.created_at ? new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  )
}
