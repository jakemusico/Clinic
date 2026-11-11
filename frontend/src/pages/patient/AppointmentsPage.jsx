import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Pagination from '../../components/Pagination'
import Dropdown from '../../components/Dropdown'
import ConfirmModal from '../../components/ConfirmModal'
import { appointmentsApi } from '../../api/appointments'
import { authApi } from '../../api/auth'
import { servicesApi } from '../../api/services'
import { formatAppointmentDate, formatAppointmentTime, todayISO } from '../../utils/dateUtils'
import Avatar from '../../components/Avatar'
import DentalIcon from '../../components/DentalIcon'
import { EMPTY } from '../../utils/emptyValue'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'
import useSubmitLock from '../../hooks/useSubmitLock'

const STATUS_BADGES = {
  pending:   'status-badge pending',
  confirmed: 'status-badge confirmed',
  completed: 'status-badge role-blue',
  cancelled: 'status-badge cancelled',
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/* ── Inline SVG Outline Icons ────────────────────────────────────────────── */
function StethoscopeIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  )
}

// Dental icon: shared <DentalIcon /> (same 2px stroke as StethoscopeIcon beside it)
const ToothIcon = ({ size = 20 }) => <DentalIcon size={size} strokeWidth={2} />

function CheckCircleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function CalendarIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function PlusIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function SearchIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function FilterIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function EyeIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

/* ── Reschedule Modal Component ──────────────────────────────────────────── */
function RescheduleModal({ appointment, onClose, onRescheduled }) {
  const [date, setDate]       = useState('')
  const [slots, setSlots]     = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [saving, setSaving]   = useState(false)
  const { lock, unlock } = useSubmitLock()

  const today = todayISO()

  const loadSlots = useCallback(async () => {
    if (!date) return
    setLoadingSlots(true); setSlots([]); setSelectedSlot(null)
    try {
      const { data } = await appointmentsApi.slots({
        date,
        staff_id: appointment.staff_id,
        appointment_type: appointment.appointment_type,
        duration: appointment.service?.duration_minutes || 30,
      })
      setSlots(data.slots || [])
    } catch {
      toast.error('Failed to load slots for this date.')
    } finally {
      setLoadingSlots(false)
    }
  }, [date, appointment])

  useEffect(() => { loadSlots() }, [loadSlots])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedSlot) return
    if (!lock()) return   // already saving (double click / second Enter)
    setSaving(true)
    try {
      const { data } = await appointmentsApi.reschedule(appointment.id, {
        scheduled_at: selectedSlot.datetime,
      })
      toast.success(data.message)
      onRescheduled(data.appointment)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reschedule appointment.')
    } finally {
      setSaving(false)
      unlock()
    }
  }

  const availableSlots = slots.filter(s => !s.is_booked)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !saving && onClose()}>
      <div className="modal-card" style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <h2>Reschedule Appointment</h2>
          <button className="modal-close" onClick={onClose} disabled={saving}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Select Preferred Date</label>
            <input type="date" value={date} min={today} onChange={e => setDate(e.target.value)} required />
          </div>

          {loadingSlots && <div className="slot-loading"><span className="loader-ring" /></div>}

          {!loadingSlots && date && slots.length === 0 && (
            <div className="slot-message">No working hours defined by staff on this day.</div>
          )}

          {!loadingSlots && date && slots.length > 0 && availableSlots.length === 0 && (
            <div className="slot-message">All slots on this date are fully booked.</div>
          )}

          {!loadingSlots && availableSlots.length > 0 && (
            <div className="form-group">
              <label>Select Time Slot</label>
              <div className="slot-grid">
                {availableSlots.map(slot => (
                  <button
                    key={slot.datetime}
                    type="button"
                    className={`slot-chip clickable ${selectedSlot?.time === slot.time ? 'active' : ''}`}
                    onClick={() => setSelectedSlot(slot)}
                  >
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !selectedSlot}>
              {saving ? <span className="btn-spinner" /> : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ── Appointment Details Modal Component ─────────────────────────────────── */
function AppointmentDetailsModal({ appointment, onClose, onReschedule, onCancel }) {
  if (!appointment) return null

  const isEditable = appointment.status === 'pending' || appointment.status === 'confirmed'
  const isDental = appointment.appointment_type === 'dental'

  const dateFormatted = formatAppointmentDate(appointment)
  const timeFormatted = formatAppointmentTime(appointment)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '520px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className={`service-icon-cell-wrap ${isDental ? 'dental' : 'medical'}`}>
              {isDental ? <ToothIcon size={20} /> : <StethoscopeIcon size={20} />}
            </div>
            <div>
              <h2 style={{ fontSize: '1.1rem', margin: 0 }}>Appointment Details</h2>
              <span style={{ fontSize: '0.785rem', color: 'var(--text-muted)' }}>
                Ref #{String(appointment.id).padStart(5, '0')}
              </span>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="details-modal-grid">
            <div className="details-modal-item">
              <span className="details-modal-label">Status</span>
              <div>
                <span className={STATUS_BADGES[appointment.status] || 'status-badge inactive'}>
                  {appointment.status}
                </span>
              </div>
            </div>

            <div className="details-modal-item">
              <span className="details-modal-label">Service Type</span>
              <span className="details-modal-value">
                {isDental ? 'Dental Care' : 'Medical Care'}
              </span>
            </div>

            <div className="details-modal-item">
              <span className="details-modal-label">Service</span>
              <span className="details-modal-value">
                {appointment.service?.name || EMPTY}
              </span>
            </div>

            <div className="details-modal-item">
              <span className="details-modal-label">Attending Provider</span>
              <span className="details-modal-value">
                {appointment.staff?.name || 'Assigned Clinic Staff'}
              </span>
            </div>

            <div className="details-modal-item">
              <span className="details-modal-label">Date</span>
              <span className="details-modal-value">{dateFormatted}</span>
            </div>

            <div className="details-modal-item">
              <span className="details-modal-label">Time</span>
              <span className="details-modal-value">{timeFormatted}</span>
            </div>
          </div>

          {appointment.notes && (
            <div className="details-modal-item" style={{ marginBottom: '1.25rem' }}>
              <span className="details-modal-label">Reason for Visit</span>
              <div className="details-notes-box" style={{ marginTop: '0.35rem' }}>
                {appointment.notes}
              </div>
            </div>
          )}

          {appointment.cancellation_reason && (
            <div className="details-modal-item" style={{ marginBottom: '1.25rem' }}>
              <span className="details-modal-label" style={{ color: 'var(--red)' }}>Cancellation Reason</span>
              <div className="details-notes-box" style={{ marginTop: '0.35rem', borderColor: 'var(--red-border)', background: 'var(--red-bg)', color: 'var(--red)' }}>
                {appointment.cancellation_reason}
              </div>
            </div>
          )}

          <div className="modal-footer" style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem', marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              {isEditable && (
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => {
                    onClose()
                    onCancel(appointment.id)
                  }}
                >
                  Cancel Appointment
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {isEditable && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    onClose()
                    onReschedule(appointment)
                  }}
                >
                  Reschedule
                </button>
              )}
              <button type="button" className="btn-ghost" onClick={onClose}>
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Interactive Month Calendar Sub-Component ────────────────────────────── */
function MonthCalendar({ currentMonthDate, onMonthChange, availableDates, selectedDate, onSelectDate }) {
  const year  = currentMonthDate.getFullYear()
  const month = currentMonthDate.getMonth()

  const todayStr = useMemo(() => todayISO(), [])
  const currentMonthStart = useMemo(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1), [])

  const canGoPrev = useMemo(() => {
    const displayedStart = new Date(year, month, 1)
    return displayedStart > currentMonthStart
  }, [year, month, currentMonthStart])

  const handlePrev = () => {
    if (canGoPrev) {
      onMonthChange(new Date(year, month - 1, 1))
    }
  }

  const handleNext = () => {
    onMonthChange(new Date(year, month + 1, 1))
  }

  // Days in month calculation
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayIndex = new Date(year, month, 1).getDay() // 0 = Sunday

  const daysCells = useMemo(() => {
    const cells = []
    // Leading blanks
    for (let i = 0; i < firstDayIndex; i++) {
      cells.push({ blank: true, key: `b-${i}` })
    }
    // Days
    for (let day = 1; day <= daysInMonth; day++) {
      const dayPad = String(day).padStart(2, '0')
      const monthPad = String(month + 1).padStart(2, '0')
      const dateStr = `${year}-${monthPad}-${dayPad}`
      const isPast = dateStr < todayStr
      const isToday = dateStr === todayStr
      const isAvailable = availableDates.includes(dateStr)
      const isSelected = selectedDate === dateStr

      cells.push({
        blank: false,
        key: dateStr,
        day,
        dateStr,
        isPast,
        isToday,
        isAvailable,
        isSelected,
      })
    }
    return cells
  }, [year, month, daysInMonth, firstDayIndex, availableDates, selectedDate, todayStr])

  return (
    <div className="booking-calendar-box">
      <div className="calendar-header">
        <span className="calendar-month-title">
          {MONTH_NAMES[month]} {year}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={handlePrev}
            disabled={!canGoPrev}
            aria-label="Previous Month"
          >
            ‹
          </button>
          <button
            type="button"
            className="calendar-nav-btn"
            onClick={handleNext}
            aria-label="Next Month"
          >
            ›
          </button>
        </div>
      </div>

      <div className="calendar-weekdays-row">
        {WEEKDAY_NAMES.map(w => <div key={w}>{w}</div>)}
      </div>

      <div className="calendar-days-grid">
        {daysCells.map(c => {
          if (c.blank) {
            return <div key={c.key} className="calendar-day-cell" />
          }
          const isClickable = c.isAvailable && !c.isPast

          return (
            <div key={c.key} className="calendar-day-cell">
              <button
                type="button"
                className={`calendar-day-btn ${c.isSelected ? 'selected' : ''} ${isClickable ? 'available' : 'disabled'} ${c.isToday ? 'today' : ''}`}
                onClick={() => isClickable && onSelectDate(c.dateStr)}
                disabled={!isClickable}
                title={c.isPast ? 'Past date' : (c.isAvailable ? 'Click to view slots' : 'No staff schedule')}
              >
                {c.day}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Custom dropdown for Filters panel that matches the Clinic Service dropdown styling
 * (.dd-wrap, .dd-trigger--filter, .dd-panel, .dd-option, etc.)
 */
function FilterCustomDropdown({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select…',
  ariaLabel,
  isOpen,
  onToggle,
  onClose,
}) {
  const wrapRef = useRef(null)

  const selected = useMemo(() => {
    return options.find(o => String(o.value) === String(value))
  }, [options, value])

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        onClose?.()
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [isOpen, onClose])

  const handleSelect = (val) => {
    onChange?.(val)
    onClose?.()
  }

  return (
    <div
      ref={wrapRef}
      className={`dd-wrap dd-wrap--filter dd-wrap-filter filter-custom-dd ${isOpen ? 'is-open' : ''}`}
      style={{
        position: 'relative',
        width: '100%',
        height: '44px',
        minHeight: '44px',
        maxHeight: '44px',
        margin: 0,
        padding: 0,
        flex: '0 0 44px',
        boxSizing: 'border-box',
      }}
    >
      <button
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={`dd-trigger dd-trigger--filter ${isOpen ? 'is-open' : ''}`}
        onClick={onToggle}
        style={{
          height: '44px',
          minHeight: '44px',
          maxHeight: '44px',
          width: '100%',
          boxSizing: 'border-box',
          fontSize: '16px',
        }}
      >
        <span className="dd-value">
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className="dd-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: `translateY(-50%) rotate(${isOpen ? 180 : 0}deg)` }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          className="dd-panel filter-custom-dd-panel is-down"
          role="listbox"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            right: 0,
            width: '100%',
            zIndex: 80,
            background: '#ffffff',
            borderRadius: 'var(--radius-md, 8px)',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
            maxHeight: '180px',
            overflowY: 'auto',
            margin: 0,
            padding: 0,
            boxSizing: 'border-box',
          }}
        >
          <div className="dd-list" style={{ maxHeight: '180px', overflowY: 'auto', margin: 0, padding: 0 }}>
            {options.map((opt) => {
              const isSelected = String(opt.value) === String(value)
              return (
                <div
                  key={opt.value}
                  role="option"
                  aria-selected={isSelected}
                  className={`dd-option ${isSelected ? 'is-selected' : ''}`}
                  onClick={() => handleSelect(opt.value)}
                  style={{ minHeight: '40px', height: '40px' }}
                >
                  <div className="dd-option-main">
                    <div className="dd-option-name">{opt.label}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main AppointmentsPage Component
   ═══════════════════════════════════════════════════════════════════════════ */
export default function AppointmentsPage() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const initTab    = searchParams.get('tab')  === 'book' ? 'book' : 'list'
  const initType   = searchParams.get('type') === 'dental' ? 'dental' : 'medical'
  const initStatus = searchParams.get('status') || 'all'
  const highlightId = searchParams.get('highlight')

  const [activeTab, setActiveTab]       = useState(initTab)
  const [appointments, setAppointments] = useState([])
  const [services, setServices]         = useState([])
  const [loading, setLoading]           = useState(true)

  // Filter & Search State for "My Appointments"
  const [statusFilter, setStatusFilter] = useState(initStatus) // 'all' | 'confirmed' | 'pending' | 'completed' | 'cancelled'
  const [searchQuery, setSearchQuery]   = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery)
  const [careCategory, setCareCategory] = useState('all') // 'all' | 'medical' | 'dental'
  const [sortOrder, setSortOrder]       = useState('newest') // 'newest' | 'oldest'
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null) // 'category' | 'sort' | null
  const filterPopoverRef = useRef(null)
  const [cancelConfirm, setCancelConfirm] = useState({ open: false, id: null, loading: false })
  const bookingLock = useSubmitLock()
  const cancelLock = useSubmitLock()

  useEffect(() => {
    if (highlightId && appointments.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`patient-appt-row-${highlightId}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 200)
    }
  }, [highlightId, appointments])

  // Details Modal State
  const [viewingAppointment, setViewingAppointment] = useState(null)

  // Booking State
  const [serviceType, setServiceType]   = useState(initType) // 'medical' | 'dental'
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [notes, setNotes]               = useState('')

  // Calendar & Slot State
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [availableDates, setAvailableDates] = useState([])
  const [selectedDate, setSelectedDate]   = useState('')
  const [slots, setSlots]                 = useState([])
  const [loadingSlots, setLoadingSlots]   = useState(false)
  const [selectedSlot, setSelectedSlot]   = useState(null)
  const [booking, setBooking]             = useState(false)
  const [readiness, setReadiness]         = useState(null) // { percent, missing[] } | null

  // Reschedule State
  const [reschedTarget, setReschedTarget] = useState(null)

  // Close filter popover on outside click or Escape key
  useEffect(() => {
    if (!filterPopoverOpen) return

    const handleClickOutside = (e) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target)) {
        setFilterPopoverOpen(false)
      }
    }

    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        setFilterPopoverOpen(false)
      }
    }

    const handleRouteChange = () => setFilterPopoverOpen(false)

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    window.addEventListener('popstate', handleRouteChange)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('popstate', handleRouteChange)
    }
  }, [filterPopoverOpen])

  // Reset only resets category and sort (not search or tab)
  const handleResetFilters = () => {
    setCareCategory('all')
    setSortOrder('newest')
    setOpenFilterDropdown(null)
  }

  // Clear all filters resets query, status tab, care category, and sort
  const handleClearAllFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setCareCategory('all')
    setSortOrder('newest')
  }

  const isFilterActive = careCategory !== 'all' || sortOrder !== 'newest'
  const hasActiveFilters = searchQuery.trim() !== '' || statusFilter !== 'all' || isFilterActive

  // Load initial appointments and clinic services
  const loadInitialData = async () => {
    setLoading(true)
    try {
      const appRes = await appointmentsApi.list()
      setAppointments(appRes.data.appointments || [])
      try {
        const pRes = await authApi.getProfile()
        setReadiness({ percent: pRes.data.readiness ?? 100, missing: pRes.data.missing_fields || [] })
      } catch { /* readiness check is best-effort; the API still enforces it */ }
    } catch {
      toast.error('Failed to load appointments data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInitialData() }, [])

  // Services of the chosen kind of care (Medical or Dental): the API does the filtering
  useEffect(() => {
    let alive = true
    servicesApi.list({ care_type: serviceType })
      .then(({ data }) => { if (alive) setServices(data.services || []) })
      .catch(() => { if (alive) { setServices([]); toast.error('Failed to load services.') } })
    return () => { alive = false }
  }, [serviceType])

  // A just-switched type can still hold the previous list for a moment
  const filteredServices = useMemo(
    () => services.filter(s => s.care_type === serviceType),
    [services, serviceType]
  )

  // Ensure a valid service is selected when services or serviceType change
  useEffect(() => {
    if (filteredServices.length > 0) {
      const exists = filteredServices.some(s => s.id === selectedServiceId)
      if (!exists) {
        setSelectedServiceId(filteredServices[0].id)
      }
    } else {
      setSelectedServiceId('')
    }
  }, [filteredServices, selectedServiceId])

  // Fetch available dates for the month
  const fetchAvailableDates = useCallback(async (monthDate, type) => {
    const year = monthDate.getFullYear()
    const month = String(monthDate.getMonth() + 1).padStart(2, '0')
    const monthStr = `${year}-${month}`

    try {
      const { data } = await appointmentsApi.availableDates({
        month: monthStr,
        appointment_type: type,
      })
      setAvailableDates(data.available_dates || [])
    } catch {
      setAvailableDates([])
    }
  }, [])

  useEffect(() => {
    fetchAvailableDates(calendarMonth, serviceType)
  }, [calendarMonth, serviceType, fetchAvailableDates])

  const handleServiceTypeChange = (newType) => {
    if (newType === serviceType) return
    setServiceType(newType)
    setSelectedDate('')
    setSlots([])
    setSelectedSlot(null)
  }

  const loadDateSlots = useCallback(async (date, type, serviceId) => {
    if (!date) {
      setSlots([])
      setSelectedSlot(null)
      return
    }

    const currentService = services.find(s => s.id === serviceId)
    const duration = currentService?.duration_minutes || 30

    setLoadingSlots(true)
    setSelectedSlot(null)
    try {
      const { data } = await appointmentsApi.slots({
        date,
        appointment_type: type,
        duration,
      })
      setSlots(data.slots || [])
    } catch {
      toast.error('Failed to load slots for this date.')
      setSlots([])
    } finally {
      setLoadingSlots(false)
    }
  }, [services])

  useEffect(() => {
    if (selectedDate) {
      loadDateSlots(selectedDate, serviceType, selectedServiceId)
    }
  }, [selectedDate, serviceType, selectedServiceId, loadDateSlots])

  const selectedService = useMemo(() => {
    return services.find(s => s.id === selectedServiceId) || null
  }, [services, selectedServiceId])

  const handleConfirmBooking = async (e) => {
    e.preventDefault()
    if (!selectedSlot) {
      toast.error('Please select an available time slot.')
      return
    }
    if (!selectedServiceId) {
      toast.error('Please choose a service.')
      return
    }
    if (!selectedSlot.staff_id) {
      toast.error('No provider assigned for this slot.')
      return
    }

    if (!bookingLock.lock()) return   // already booking (double click / second Enter)
    setBooking(true)
    try {
      const { data } = await appointmentsApi.create({
        appointment_type: serviceType,
        service_id:       parseInt(selectedServiceId),
        staff_id:         parseInt(selectedSlot.staff_id),
        scheduled_at:     selectedSlot.datetime,
        notes:            notes.trim() || null,
      })

      toast.success(data.message || 'Appointment booked successfully!')
      setAppointments(prev => [data.appointment, ...prev])
      setNotes('')
      setSelectedDate('')
      setSelectedSlot(null)
      setSlots([])
      setActiveTab('list')
      window.dispatchEvent(new Event('appointments-updated'))
    } catch (err) {
      const missing = err?.response?.data?.missing_fields
      if (missing?.length) {
        toast.error('Finish your profile first to book an appointment.')
      } else {
        toast.error(err?.response?.data?.message || 'Failed to book appointment.')
      }
    } finally {
      setBooking(false)
      bookingLock.unlock()
    }
  }

  const handleCancelAppointment = (id) => {
    setCancelConfirm({ open: true, id, loading: false })
  }

  const doCancelAppointment = async () => {
    if (!cancelConfirm.id) return
    if (!cancelLock.lock()) return   // already cancelling (double click)
    setCancelConfirm(prev => ({ ...prev, loading: true }))
    try {
      const { data } = await appointmentsApi.updateStatus(cancelConfirm.id, {
        status: 'cancelled',
        cancellation_reason: 'Cancelled by patient.',
      })
      setAppointments(prev => prev.map(a => a.id === cancelConfirm.id ? data.appointment : a))
      toast.success('Appointment cancelled.')
      window.dispatchEvent(new Event('appointments-updated'))
      setCancelConfirm({ open: false, id: null, loading: false })
      if (viewingAppointment?.id === cancelConfirm.id) {
        setViewingAppointment(null)
      }
    } catch {
      toast.error('Failed to cancel appointment.')
      setCancelConfirm(prev => ({ ...prev, loading: false }))
    } finally {
      cancelLock.unlock()
    }
  }

  const handleRescheduled = (updated) => {
    setAppointments(prev => prev.map(a => a.id === updated.id ? updated : a))
    setReschedTarget(null)
  }

  const formattedSummaryDate = useMemo(() => {
    if (!selectedDate) return EMPTY
    const parts = selectedDate.split('-')
    const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  }, [selectedDate])

  // Helper to get appointment timestamp reliably for sorting
  const getApptTimestamp = (a) => {
    const raw = a.scheduled_at || a.appointment_date || a.date
    if (!raw) return 0
    const d = new Date(raw)
    return Number.isNaN(d.getTime()) ? 0 : d.getTime()
  }

  /* ── Care Category Options (dynamically from actual appointment data) ─── */
  const careCategoryOptions = useMemo(() => {
    const uniqueTypes = new Set()
    appointments.forEach(a => {
      const type = (a.appointment_type || a.service?.care_type || '').toLowerCase()
      if (type) uniqueTypes.add(type)
    })

    const options = [{ value: 'all', label: 'All Care Types' }]
    if (uniqueTypes.has('medical')) {
      options.push({ value: 'medical', label: 'Medical Care' })
    }
    if (uniqueTypes.has('dental')) {
      options.push({ value: 'dental', label: 'Dental Care' })
    }
    uniqueTypes.forEach(t => {
      if (t !== 'medical' && t !== 'dental') {
        options.push({ value: t, label: t.charAt(0).toUpperCase() + t.slice(1) })
      }
    })
    return options
  }, [appointments])

  /* ── Filtered & Searched Appointments List ────────────────────────────── */
  const filteredAppointments = useMemo(() => {
    return appointments.filter(a => {
      // 1. Status Filter
      if (statusFilter !== 'all' && a.status !== statusFilter) {
        return false
      }

      // 2. Care Category Filter
      if (careCategory !== 'all') {
        const type = (a.appointment_type || a.service?.care_type || '').toLowerCase()
        if (type !== careCategory.toLowerCase()) {
          return false
        }
      }

      // 3. Search Query Filter
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.trim().toLowerCase()
        const idMatch = String(a.id || '').toLowerCase().includes(q) || `#${a.id}`.includes(q)
        const serviceMatch = (a.service?.name || '').toLowerCase().includes(q)
        const staffMatch = (a.staff?.name || a.provider || '').toLowerCase().includes(q)
        const notesMatch = (a.notes || a.reason || '').toLowerCase().includes(q)
        const typeMatch = (a.appointment_type || a.service?.care_type || '').toLowerCase().includes(q)
        const dateFormatted = formatAppointmentDate(a).toLowerCase()
        const timeFormatted = formatAppointmentTime(a).toLowerCase()
        const rawDateMatch = String(a.scheduled_at || a.appointment_date || '').toLowerCase().includes(q)

        if (!idMatch && !serviceMatch && !staffMatch && !notesMatch && !typeMatch && !dateFormatted.includes(q) && !timeFormatted.includes(q) && !rawDateMatch) {
          return false
        }
      }

      return true
    }).sort((a, b) => {
      const dateA = getApptTimestamp(a)
      const dateB = getApptTimestamp(b)
      return sortOrder === 'newest' ? dateB - dateA : dateA - dateB
    })
  }, [appointments, statusFilter, careCategory, debouncedSearchQuery, sortOrder])

  /* ── Status Counts (reflect active careCategory + search filter) ─────── */
  const counts = useMemo(() => {
    const baseFiltered = appointments.filter(a => {
      // Care category filter
      if (careCategory !== 'all') {
        const type = (a.appointment_type || a.service?.care_type || '').toLowerCase()
        if (type !== careCategory.toLowerCase()) {
          return false
        }
      }
      // Search filter
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.trim().toLowerCase()
        const idMatch = String(a.id || '').toLowerCase().includes(q) || `#${a.id}`.includes(q)
        const serviceMatch = (a.service?.name || '').toLowerCase().includes(q)
        const staffMatch = (a.staff?.name || a.provider || '').toLowerCase().includes(q)
        const notesMatch = (a.notes || a.reason || '').toLowerCase().includes(q)
        const typeMatch = (a.appointment_type || a.service?.care_type || '').toLowerCase().includes(q)
        const dateFormatted = formatAppointmentDate(a).toLowerCase()
        const timeFormatted = formatAppointmentTime(a).toLowerCase()
        const rawDateMatch = String(a.scheduled_at || a.appointment_date || '').toLowerCase().includes(q)

        if (!idMatch && !serviceMatch && !staffMatch && !notesMatch && !typeMatch && !dateFormatted.includes(q) && !timeFormatted.includes(q) && !rawDateMatch) {
          return false
        }
      }
      return true
    })

    const c = { all: baseFiltered.length, confirmed: 0, pending: 0, completed: 0, cancelled: 0 }
    baseFiltered.forEach(a => {
      if (c[a.status] !== undefined) {
        c[a.status]++
      }
    })
    return c
  }, [appointments, careCategory, debouncedSearchQuery])

  const [apptPage, setApptPage] = useState(1)
  const [apptPageSize, setApptPageSize] = useState(10)

  useEffect(() => {
    setApptPage(1)
  }, [statusFilter, careCategory, debouncedSearchQuery, sortOrder])

  const apptTotalPages = Math.max(1, Math.ceil(filteredAppointments.length / apptPageSize))
  const paginatedAppointments = filteredAppointments.slice((apptPage - 1) * apptPageSize, apptPage * apptPageSize)

  return (
    <DashboardLayout
      title="My Appointments"
      subtitle="Track and manage your clinic visits"
      stats={[]}
    >
      <div className={`appointments-page-container ${activeTab === 'list' ? 'page-fixed-list fixed-list-layout' : 'page-book-tab'}`}>
        {/* Fixed Top Section: Title + Subtitle + Toggle + Status Tabs + Search/Filters */}
        <div className={activeTab === 'list' ? 'fixed-list-top' : 'book-fixed-top'}>
          {/* Top Header / Action Row */}
          <div className="my-appointments-header-wrap">
            <div className="my-appointments-title-group">
              <h1>{activeTab === 'book' ? 'Book an Appointment' : 'My Appointments'}</h1>
              <p>
                {activeTab === 'book'
                  ? 'Schedule a medical or dental visit in a few steps'
                  : 'Track and manage your clinic visits'}
              </p>
            </div>

            {/* Two Tabs: Book / My Appointments */}
            <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
              <button
                type="button"
                className={`btn-tab-mode ${activeTab === 'book' ? 'active' : ''}`}
                onClick={() => setActiveTab('book')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 1.1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'book' ? 'var(--accent)' : 'transparent',
                  color: activeTab === 'book' ? '#ffffff' : 'var(--text-sub)',
                  boxShadow: activeTab === 'book' ? '0 1px 3px rgba(37,99,235,0.2)' : 'none',
                  transition: 'all var(--transition)',
                }}
              >
                <PlusIcon size={15} />
                <span>Book</span>
              </button>
              <button
                type="button"
                className={`btn-tab-mode ${activeTab === 'list' ? 'active' : ''}`}
                onClick={() => setActiveTab('list')}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.5rem 1.1rem',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  cursor: 'pointer',
                  background: activeTab === 'list' ? 'var(--accent)' : 'transparent',
                  color: activeTab === 'list' ? '#ffffff' : 'var(--text-sub)',
                  boxShadow: activeTab === 'list' ? '0 1px 3px rgba(37,99,235,0.2)' : 'none',
                  transition: 'all var(--transition)',
                }}
              >
                <CalendarIcon size={15} />
                <span>My Appointments</span>
                {appointments.length > 0 && (
                  <span style={{
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    padding: '0.1rem 0.5rem',
                    borderRadius: '999px',
                    background: activeTab === 'list' ? 'rgba(255,255,255,0.3)' : 'var(--border)',
                    color: activeTab === 'list' ? '#ffffff' : 'var(--text-muted)',
                  }}>
                    {appointments.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {activeTab === 'list' && (
            <>
              {/* Status Filter Tabs */}
              <div className="status-tabs-bar">
                {[
                  { id: 'all', label: 'All', count: counts.all },
                  { id: 'confirmed', label: 'Confirmed', count: counts.confirmed },
                  { id: 'pending', label: 'Pending', count: counts.pending },
                  { id: 'completed', label: 'Completed', count: counts.completed },
                  { id: 'cancelled', label: 'Cancelled', count: counts.cancelled },
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    className={`status-pill-tab ${statusFilter === tab.id ? 'active' : ''}`}
                    onClick={() => setStatusFilter(tab.id)}
                  >
                    <span>{tab.label}</span>
                    <span className="status-tab-count">{tab.count}</span>
                  </button>
                ))}
              </div>

              {/* Toolbar: Search + Filter */}
              <div className="appointments-toolbar">
                <div className="appointments-search-box">
                  <SearchIcon size={16} />
                  <input
                    type="text"
                    className="appointments-search-input"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search appointments"
                  />
                </div>

                <div className="appointments-filter-actions" ref={filterPopoverRef}>
                  <button
                    type="button"
                    className={`filter-btn-pill ${isFilterActive ? 'active' : ''}`}
                    onClick={() => setFilterPopoverOpen(prev => !prev)}
                    aria-expanded={filterPopoverOpen}
                    aria-label="Filter and sort appointments"
                  >
                    <FilterIcon size={15} />
                    <span>Filters</span>
                    {isFilterActive && <span className="filter-active-dot" aria-hidden="true" />}
                  </button>

                  {/* Filters Dropdown Popover (anchored under Filters button on all screen sizes) */}
                  {filterPopoverOpen && (
                    <div
                      className="filter-popover-card"
                      role="dialog"
                      aria-label="Filter and sort appointments"
                    >
                      <div className="filter-popover-body">
                        <div
                          className={`filter-popover-group ${openFilterDropdown === 'category' ? 'is-open' : ''}`}
                          style={{ position: 'relative', zIndex: openFilterDropdown === 'category' ? 90 : 30 }}
                        >
                          <label className="filter-popover-title">Care Category</label>
                          <FilterCustomDropdown
                            ariaLabel="Care category"
                            value={careCategory}
                            onChange={setCareCategory}
                            options={careCategoryOptions}
                            isOpen={openFilterDropdown === 'category'}
                            onToggle={() => setOpenFilterDropdown(prev => prev === 'category' ? null : 'category')}
                            onClose={() => setOpenFilterDropdown(null)}
                          />
                        </div>

                        <div
                          className={`filter-popover-group ${openFilterDropdown === 'sort' ? 'is-open' : ''}`}
                          style={{ position: 'relative', zIndex: openFilterDropdown === 'sort' ? 90 : 20 }}
                        >
                          <label className="filter-popover-title">Sort By Date</label>
                          <FilterCustomDropdown
                            ariaLabel="Sort by date"
                            value={sortOrder}
                            onChange={setSortOrder}
                            options={[
                              { value: 'newest', label: 'Newest to Oldest' },
                              { value: 'oldest', label: 'Oldest to Newest' },
                            ]}
                            isOpen={openFilterDropdown === 'sort'}
                            onToggle={() => setOpenFilterDropdown(prev => prev === 'sort' ? null : 'sort')}
                            onClose={() => setOpenFilterDropdown(null)}
                          />
                        </div>
                      </div>

                      <div className="filter-popover-footer" style={{ position: 'relative', zIndex: 10 }}>
                        <button
                          type="button"
                          className="btn-filter-secondary"
                          onClick={handleResetFilters}
                        >
                          Reset
                        </button>
                        <button
                          type="button"
                          className="btn-filter-primary filter-popover-apply-btn"
                          onClick={() => {
                            setOpenFilterDropdown(null)
                            setFilterPopoverOpen(false)
                          }}
                        >
                          Apply
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {loading ? (
          <div className="table-loading"><span className="loader-ring" /></div>
        ) : (
          <>
            {/* ═══════════════════════════════════════════════════════════════
               MY APPOINTMENTS LIST TAB
               ═══════════════════════════════════════════════════════════════ */}
            {activeTab === 'list' && (
              <div className="fixed-list-body">
                {/* Scroll Section: ONLY the cards list */}
                <div className="fixed-list-scroll">
                  {filteredAppointments.length === 0 ? (
                    <div className="empty-state" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '3.5rem 1.5rem', textAlign: 'center' }}>
                      <CalendarIcon size={36} />
                      <h3 style={{ marginTop: '0.75rem', marginBottom: '0.35rem', fontSize: '1.1rem' }}>
                        {hasActiveFilters ? 'No appointments match your filters' : 'No appointments found'}
                      </h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {hasActiveFilters
                          ? 'No appointments matched your current search or filter criteria.'
                          : 'You do not have any appointments scheduled yet.'}
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ marginTop: '1.25rem' }}
                          onClick={handleClearAllFilters}
                        >
                          Clear filters
                        </button>
                      )}
                      {!hasActiveFilters && (
                        <button
                          type="button"
                          className="btn-primary"
                          style={{ marginTop: '1.25rem' }}
                          onClick={() => setActiveTab('book')}
                        >
                          Book an Appointment
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="data-table-wrap" style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Service</th>
                            <th>Date & Time</th>
                            <th>Provider</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'right' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedAppointments.map(a => {
                            const isDental = a.appointment_type === 'dental'
                            const dateLine = formatAppointmentDate(a)
                            const timeLine = formatAppointmentTime(a)

                            return (
                              <tr
                                key={a.id}
                                id={`patient-appt-row-${a.id}`}
                                style={String(a.id) === String(highlightId) ? { backgroundColor: 'rgba(59, 130, 246, 0.12)', outline: '2px solid var(--accent)', transition: 'all 0.5s ease' } : {}}
                              >
                                {/* Service Column */}
                                <td>
                                  <div className="service-table-cell">
                                    <div className={`service-icon-cell-wrap ${isDental ? 'dental' : 'medical'}`}>
                                      {isDental ? <ToothIcon size={18} /> : <StethoscopeIcon size={18} />}
                                    </div>
                                    <div className="service-cell-info">
                                      <span className="service-cell-name">{a.service?.name || 'Clinic Consultation'}</span>
                                      <span className="service-cell-type">
                                        {isDental ? 'Dental Care' : 'Medical Care'}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Date & Time Column (Two Lines) */}
                                <td>
                                  <div className="datetime-table-cell">
                                    <span className="datetime-cell-date">{dateLine}</span>
                                    <span className="datetime-cell-time">{timeLine}</span>
                                    <span className={`status-badge-mobile ${STATUS_BADGES[a.status] || 'status-badge inactive'}`.replace('status-badge ', '')}>
                                      {a.status}
                                    </span>
                                  </div>
                                </td>

                                {/* Provider Column */}
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                                    <Avatar src={a.staff?.avatar_url} name={a.staff?.name} size={32} />
                                    <div className="provider-table-cell">
                                      <span className="provider-cell-name">{a.staff?.name || 'Attending Staff'}</span>
                                      <span className="provider-cell-role">
                                        {isDental ? 'Dentist' : 'Clinic Nurse'}
                                      </span>
                                    </div>
                                  </div>
                                </td>

                                {/* Status Column */}
                                <td>
                                  <span className={STATUS_BADGES[a.status] || 'status-badge inactive'}>
                                    {a.status}
                                  </span>
                                </td>

                                {/* Action Column */}
                                <td style={{ textAlign: 'right' }}>
                                  <button
                                    type="button"
                                    className="btn-view-pill"
                                    onClick={() => setViewingAppointment(a)}
                                    title="View Appointment Details"
                                  >
                                    <EyeIcon size={14} />
                                    <span>View</span>
                                  </button>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Fixed Bottom Section: Pagination */}
                {filteredAppointments.length > 0 && (
                  <div className="fixed-list-bottom">
                    <Pagination
                      currentPage={apptPage}
                      totalPages={apptTotalPages}
                      totalItems={filteredAppointments.length}
                      pageSize={apptPageSize}
                      onPageChange={setApptPage}
                      onPageSizeChange={(newSize) => {
                        setApptPageSize(newSize)
                        setApptPage(1)
                      }}
                    />
                  </div>
                )}
              </div>
            )}

            {/* ═══════════════════════════════════════════════════════════════
               BOOK APPOINTMENT TAB (2-COLUMN MODERN REDESIGN)
               ═══════════════════════════════════════════════════════════════ */}
            {activeTab === 'book' && (
              <div className="book-scroll-section">
              <div className="book-appointment-layout">
              {/* Left Column: Form Steps */}
              <div className="booking-form-card">
                {readiness && readiness.percent < 100 && (
                  <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid #F59E0B', background: '#FFFBEB', fontSize: '0.85rem', color: '#92400E' }}>
                    <strong>Your profile isn't complete yet</strong>
                    <div style={{ marginTop: '0.25rem' }}>Please add your {readiness.missing.join(', ')} in My Profile first, then you can book.</div>
                    <a href="/profile" style={{ display: 'inline-block', marginTop: '0.4rem', color: 'var(--accent)', fontWeight: 600 }}>Go to My Profile</a>
                  </div>
                )}
                {/* Step 1: Choose Service Type */}
                <div className="booking-step">
                  <div className="booking-step-header">
                    <span className="step-badge">1</span>
                    <h3 className="step-title">Choose service type</h3>
                  </div>
                  <div className="service-type-grid">
                    <button
                      type="button"
                      className={`service-type-card ${serviceType === 'medical' ? 'selected' : ''}`}
                      onClick={() => handleServiceTypeChange('medical')}
                    >
                      <div className="service-type-icon">
                        <StethoscopeIcon />
                      </div>
                      <div>
                        <div className="service-type-name">Medical</div>
                        <div className="service-type-desc">General health & consultations</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      className={`service-type-card ${serviceType === 'dental' ? 'selected' : ''}`}
                      onClick={() => handleServiceTypeChange('dental')}
                    >
                      <div className="service-type-icon">
                        <ToothIcon />
                      </div>
                      <div>
                        <div className="service-type-name">Dental</div>
                        <div className="service-type-desc">Dental care & oral health</div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Step 2: Select Service */}
                <div className="booking-step">
                  <div className="booking-step-header">
                    <span className="step-badge">2</span>
                    <h3 className="step-title">Select service</h3>
                  </div>
                  {filteredServices.length === 0 ? (
                    <div className="text-muted" style={{ fontSize: '0.85rem' }}>
                      No active {serviceType} services available at this time.
                    </div>
                  ) : (
                    <>
                      <div className="service-pills-wrap">
                        {filteredServices.map(s => {
                          const isSelected = selectedServiceId === s.id
                          return (
                            <button
                              key={s.id}
                              type="button"
                              className={`service-pill-btn ${isSelected ? 'selected' : ''}`}
                              onClick={() => setSelectedServiceId(s.id)}
                            >
                              <span>{s.name}</span>
                            </button>
                          )
                        })}
                      </div>
                      {selectedService?.description && (
                        <p style={{ marginTop: '0.75rem', fontSize: '0.825rem', color: 'var(--text-muted)', lineHeight: '1.45' }}>
                          {selectedService.description}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Step 3: Pick Date & Time */}
                <div className="booking-step">
                  <div className="booking-step-header">
                    <span className="step-badge">3</span>
                    <h3 className="step-title">Pick date & time</h3>
                  </div>

                  <div className="datetime-picker-grid">
                    {/* Left: Calendar */}
                    <div>
                      <MonthCalendar
                        currentMonthDate={calendarMonth}
                        onMonthChange={setCalendarMonth}
                        availableDates={availableDates}
                        selectedDate={selectedDate}
                        onSelectDate={setSelectedDate}
                      />
                    </div>

                    {/* Right: Available Slots Grid */}
                    <div className="booking-slots-box">
                      <div className="slots-header">
                        <span>Available Slots</span>
                        {selectedDate && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 500 }}>
                            {selectedDate}
                          </span>
                        )}
                      </div>

                      {!selectedDate ? (
                        <div className="slot-empty-notice">
                          <CalendarIcon size={28} />
                          <div style={{ marginTop: '0.5rem' }}>
                            Select an available date on the calendar to see time slots.
                          </div>
                        </div>
                      ) : loadingSlots ? (
                        <div style={{ textAlign: 'center', padding: '2rem 0' }}>
                          <span className="loader-ring" />
                        </div>
                      ) : slots.length === 0 ? (
                        <div className="slot-empty-notice">
                          No working hours or slots configured for this date.
                        </div>
                      ) : (
                        <div className="slots-pill-grid">
                          {slots.map(slot => {
                            const isBooked = slot.is_booked
                            const isSelected = selectedSlot?.datetime === slot.datetime

                            return (
                              <button
                                key={slot.datetime}
                                type="button"
                                className={`slot-pill-btn ${isBooked ? 'booked' : ''} ${isSelected ? 'selected' : ''}`}
                                onClick={() => !isBooked && setSelectedSlot(slot)}
                                disabled={isBooked}
                                title={isBooked ? `Booked (${slot.provider || 'Staff'})` : `Available with ${slot.provider || 'Staff'}`}
                              >
                                {slot.label}
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Step 4: Reason for Visit */}
                <div className="booking-step">
                  <div className="booking-step-header">
                    <span className="step-badge">4</span>
                    <h3 className="step-title">Reason for visit (Optional)</h3>
                  </div>
                  <textarea
                    className="reason-textarea"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Briefly describe your symptoms, purpose, or reason for the appointment (e.g., athletic clearance, scholarship, medical check-up)..."
                    rows={3}
                    maxLength={500}
                  />
                </div>
              </div>

              {/* Right Column: Sticky Summary Panel */}
              <div className="appointment-summary-card">
                <div className="summary-title">
                  <CalendarIcon size={20} />
                  <span>Appointment Summary</span>
                </div>

                <div className="summary-rows-list">
                  <div className="summary-row">
                    <span className="summary-label">Type:</span>
                    <span className="summary-value highlight" style={{ textTransform: 'capitalize' }}>
                      {serviceType === 'dental' ? 'Dental' : 'Medical'}
                    </span>
                  </div>

                  <div className="summary-row">
                    <span className="summary-label">Service:</span>
                    <span className="summary-value">
                      {selectedService?.name || EMPTY}
                    </span>
                  </div>

                  <div className="summary-row">
                    <span className="summary-label">Date:</span>
                    <span className="summary-value">
                      {formattedSummaryDate}
                    </span>
                  </div>

                  <div className="summary-row">
                    <span className="summary-label">Time:</span>
                    <span className="summary-value">
                      {selectedSlot?.label || EMPTY}
                    </span>
                  </div>

                  <div className="summary-row">
                    <span className="summary-label">Provider:</span>
                    <span className="summary-value">
                      {selectedSlot?.provider || selectedSlot?.staff_name || EMPTY}
                    </span>
                  </div>
                </div>

                {/* Confirmation Note */}
                <div className="summary-note-box">
                  <CheckCircleIcon size={18} />
                  <span>You'll get a confirmation and reminders in your Notifications.</span>
                </div>

                {/* Actions */}
                <div className="summary-actions">
                  <button
                    type="button"
                    className="confirm-booking-btn"
                    onClick={handleConfirmBooking}
                    disabled={booking || !selectedSlot || !selectedServiceId || (readiness != null && readiness.percent < 100)}
                  >
                    {booking ? (
                      <span className="btn-spinner" />
                    ) : (
                      <>
                        <span>Confirm Appointment</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    className="view-appointments-link"
                    onClick={() => setActiveTab('list')}
                  >
                    View my appointments
                  </button>
                </div>
              </div>
            </div>
            </div>
          )}
        </>
      )}
      </div>

      {/* Appointment Details Modal */}
      {viewingAppointment && (
        <AppointmentDetailsModal
          appointment={viewingAppointment}
          onClose={() => setViewingAppointment(null)}
          onReschedule={setReschedTarget}
          onCancel={handleCancelAppointment}
        />
      )}

      {/* Reschedule Modal */}
      {reschedTarget && (
        <RescheduleModal
          appointment={reschedTarget}
          onClose={() => setReschedTarget(null)}
          onRescheduled={handleRescheduled}
        />
      )}
      {/* Cancel Appointment Modal */}
      <ConfirmModal
        open={cancelConfirm.open}
        title="Cancel Appointment"
        message="Are you sure you want to cancel this appointment?"
        confirmLabel="Cancel Appointment"
        cancelLabel="Keep Appointment"
        danger={true}
        loading={cancelConfirm.loading}
        onConfirm={doCancelAppointment}
        onCancel={() => setCancelConfirm({ open: false, id: null, loading: false })}
      />
    </DashboardLayout>
  )
}
