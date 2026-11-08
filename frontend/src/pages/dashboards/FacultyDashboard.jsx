import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { dashboardApi } from '../../api/dashboard'
import { useAuth } from '../../context/AuthContext'
import { CardFallback, LoadError } from '../../components/dashboard/Fallbacks'
import { getApiErrorMessage } from '../../utils/apiError'
import { formatAppointmentDate, formatAppointmentTime } from '../../utils/dateUtils'
import { EMPTY } from '../../utils/emptyValue'

const CalendarWidget = lazy(() => import('../../components/CalendarWidget'))

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const STATUS_MAP = {
  pending:   { label: 'Pending',   cls: 'pending' },
  confirmed: { label: 'Confirmed', cls: 'confirmed' },
  completed: { label: 'Completed', cls: 'completed' },
  cancelled: { label: 'Cancelled', cls: 'cancelled' },
}

export default function FacultyDashboard() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // ONE request for the whole dashboard: counts, appointments, notifications and calendar events
  const load = useCallback(async () => {
    try {
      setError('')
      const res = await dashboardApi.student()
      setData(res.data)
    } catch (e) {
      console.error('Failed to load dashboard', e)
      setError(getApiErrorMessage(e, 'Could not load your dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const retry = () => { setLoading(true); load() }
  const failed = Boolean(error) && !data   // nothing to show: the cards must not read as zeros

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

  const stats = [
    { value: loading || failed ? EMPTY : (data?.stats?.upcoming_appointments ?? 0), label: 'Upcoming Appointments', icon: 'appointments' },
    { value: loading || failed ? EMPTY : (data?.stats?.completed_visits ?? 0), label: 'Completed Visits',      icon: 'myRecords' },
    { value: loading || failed ? EMPTY : unread,               label: 'Unread Notifications',  icon: 'notifications' },
  ]

  return (
    <DashboardLayout
      title="Faculty & Staff Dashboard"
      subtitle="Stay on top of your health and clinic visits."
      stats={stats}
    >
      {error && !loading && <div style={{ marginBottom: '1.25rem' }}><LoadError message={error} onRetry={retry} /></div>}
      <div className="dashboard-main-grid">
        
        {/* ── Main Column ────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Next Appointment */}
          <div className="data-table-wrap">
            <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Next Appointment</span>
            </div>
            {loading ? (
              <div className="table-loading"><div className="loader-ring" /></div>
            ) : nextAppointment ? (
              <div style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text)', marginBottom: '0.25rem' }}>
                    {nextAppointment.clinic_service?.name || nextAppointment.service?.name || EMPTY}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                    {formatAppointmentDate(nextAppointment)} · {formatAppointmentTime(nextAppointment)}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                    with {nextAppointment.staff?.name || 'Assigned Staff'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                  <span className={`status-badge ${STATUS_MAP[nextAppointment.status]?.cls || 'pending'}`}>
                    {STATUS_MAP[nextAppointment.status]?.label || nextAppointment.status}
                  </span>
                  <Link to="/appointments" className="btn-secondary" style={{ padding: '0.25rem 0.75rem', fontSize: '0.75rem' }}>View</Link>
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                <p>No upcoming appointments.</p>
                <Link to="/appointments" className="btn-primary" style={{ marginTop: '0.75rem', display: 'inline-flex', padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}>Book Appointment</Link>
              </div>
            )}
          </div>

          {/* Quick Access */}
          <div>
            <p className="quick-links-section-title">Quick Access</p>
            <div className="quick-links-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
              {[
                { to: '/appointments', label: 'Book Appointment', desc: 'Schedule a new consultation', icon: 'M8 2v4M16 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z' },
                { to: '/my-records',   label: 'My Health Records', desc: 'View past consultation records', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2' },
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
