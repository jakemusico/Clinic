import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { calendarApi } from '../api/calendar'
import { formatAppointmentTime } from '../utils/dateUtils'

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

function formatTime(timeStr) {
  if (!timeStr) return ''
  const parts = timeStr.split(':')
  if (parts.length < 2) return timeStr
  let hour = parseInt(parts[0], 10)
  const min = parts[1].padStart(2, '0')
  const ampm = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${min} ${ampm}`
}

/**
 * @param events  optional. The dashboards send the calendar events along with their own data;
 *                when given, the widget makes no request of its own.
 */
export default function CalendarWidget({ appointments = [], userRole = '', events: providedEvents }) {
  const [fetchedEvents, setEvents] = useState([])
  const events = providedEvents ?? fetchedEvents
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('calendar_collapsed') === 'true'
  })

  useEffect(() => {
    if (providedEvents !== undefined) return
    calendarApi.list().then(res => {
      setEvents(res.data.events || [])
    }).catch(err => console.error(err))
  }, [providedEvents])

  const toggleCollapse = () => {
    const val = !isCollapsed
    setIsCollapsed(val)
    localStorage.setItem('calendar_collapsed', val)
  }

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay()
  const lastDayIndex = new Date(year, month, daysInMonth).getDay()
  const prevMonthDays = new Date(year, month, 0).getDate()

  const days = []
  for (let x = firstDayIndex; x > 0; x--) {
    days.push({ date: new Date(year, month - 1, prevMonthDays - x + 1), currentMonth: false })
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: new Date(year, month, i), currentMonth: true })
  }
  for (let j = 1; j <= 6 - lastDayIndex; j++) {
    days.push({ date: new Date(year, month + 1, j), currentMonth: false })
  }

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1))

  const isToday = (d) => {
    const today = new Date()
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear()
  }

  const isSelected = (d) => {
    return d.getDate() === selectedDate.getDate() &&
           d.getMonth() === selectedDate.getMonth() &&
           d.getFullYear() === selectedDate.getFullYear()
  }

  const getEventsForDate = (d) => {
    const dStr = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
    return events.filter(e => {
      const start = e.start_date ? String(e.start_date).split('T')[0] : ''
      const end = e.end_date ? String(e.end_date).split('T')[0] : ''
      if (start && start <= dStr && (!end || end >= dStr)) return true
      return false
    })
  }

  const getAppointmentsForDate = (d) => {
    if (userRole === 'admin') return []
    const dStr = [d.getFullYear(), String(d.getMonth() + 1).padStart(2, '0'), String(d.getDate()).padStart(2, '0')].join('-')
    return appointments.filter(a => (a.appointment_date || '').startsWith(dStr) || (a.scheduled_at || '').startsWith(dStr))
  }

  const selectedEvents = getEventsForDate(selectedDate)
  const selectedAppointments = getAppointmentsForDate(selectedDate)

  return (
    <div className="data-table-wrap" style={{ display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '0.85rem 1rem', borderBottom: isCollapsed ? 'none' : '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Icon d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2z M19 20H5V10h14v10z M19 8H5V6h14v2z" size={16} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>Calendar</span>
        </div>
      </div>

      {!isCollapsed && (
        <>
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <Icon d="M15 18l-6-6 6-6" />
              </button>
              <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                {currentDate.toLocaleString('default', { month: 'short' })} {year}
              </div>
              <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <Icon d="M9 18l6-6-6-6" />
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', textAlign: 'center', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
              {['S','M','T','W','T','F','S'].map((day, i) => <div key={i}>{day}</div>)}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.25rem', textAlign: 'center' }}>
              {days.map((day, i) => {
                const evts = getEventsForDate(day.date)
                const appts = getAppointmentsForDate(day.date)
                const today = isToday(day.date)
                const sel = isSelected(day.date)
                
                let textColor = day.currentMonth ? 'var(--text)' : 'var(--text-muted)'
                let bgColor = 'transparent'
                let fontWeight = 400
                let isDarkBlue = false

                if (appts.length > 0) {
                  isDarkBlue = true
                  fontWeight = 700
                }

                if (today) {
                  bgColor = 'var(--accent)'
                  textColor = '#fff'
                  fontWeight = 700
                  isDarkBlue = false
                } else if (sel) {
                  bgColor = 'var(--bg-hover)'
                }

                return (
                  <div key={i} onClick={() => setSelectedDate(day.date)} style={{ display: 'flex', justifyContent: 'center', flexDirection: 'column', alignItems: 'center', position: 'relative', height: '36px', cursor: 'pointer', opacity: day.currentMonth ? 1 : 0.5 }}>
                    <div style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: bgColor, color: isDarkBlue ? 'var(--accent)' : textColor, fontWeight }}>
                      {day.date.getDate()}
                    </div>
                    {evts.length > 0 && (
                      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: today ? 'var(--accent)' : 'var(--text-muted)', position: 'absolute', bottom: '2px' }} />
                    )}
                  </div>
                )
              })}
            </div>

          </div>

          <div style={{ background: 'var(--bg-card)', padding: '1rem', borderTop: '1px solid var(--border)', flex: 1 }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text)' }}>
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {selectedAppointments.length === 0 && selectedEvents.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No schedule for this day.</div>
              ) : (
                <>
                  {/* Appointments first */}
                  {selectedAppointments.map(a => {
                    const s = STATUS_MAP[a.status] || { label: a.status, cls: 'pending' }
                    const patientName = a.patient?.user?.name || a.patient?.name || 'Patient'
                    const serviceName = a.clinic_service?.name || a.service?.name || 'Service'
                    const apptLink = userRole === 'dentist' ? '/dental/appointments' : (userRole === 'clinic_staff' ? '/clinic/appointments' : '/appointments')
                    return (
                      <div key={`appt-${a.id}`} style={{ fontSize: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '0.5rem', borderBottom: '1px dashed var(--border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--accent)' }}>{formatAppointmentTime(a)} - {serviceName}</div>
                          {['clinic_staff', 'dentist'].includes(userRole) && <div style={{ color: 'var(--text)' }}>{patientName}</div>}
                          <div><span className={`status-badge ${s.cls}`}>{s.label}</span></div>
                        </div>
                        <Link to={apptLink} style={{ color: 'var(--accent)', fontWeight: 600 }}>View</Link>
                      </div>
                    )
                  })}
                  {/* Events next */}
                  {selectedEvents.map(e => (
                    <div key={`evt-${e.id}`} style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', paddingBottom: '0.5rem', borderBottom: '1px dashed var(--border)' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)' }}>{e.title}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}>
                        {e.all_day ? 'All day' : `${formatTime(e.start_time)}${e.end_time ? ' - ' + formatTime(e.end_time) : ''}`} · {e.type}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
          
          <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: userRole === 'admin' ? 'space-between' : 'flex-end', fontSize: '0.75rem', fontWeight: 600 }}>
            {userRole === 'admin' && (
              <Link to="/admin/calendar" style={{ color: 'var(--accent)' }}>Manage Calendar</Link>
            )}
            <button onClick={toggleCollapse} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Hide</button>
          </div>
        </>
      )}
      {isCollapsed && (
        <div style={{ padding: '0.75rem 1rem', display: 'flex', justifyContent: 'flex-end', fontSize: '0.75rem' }}>
          <button onClick={toggleCollapse} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}>Show</button>
        </div>
      )}
    </div>
  )
}
