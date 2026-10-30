import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import { appointmentsApi } from '../../api/appointments'
import { ViewConsultationModal } from '../../components/ViewConsultationModal'
import { useAuth } from '../../context/AuthContext'
import { formatAppointmentDateTime } from '../../utils/dateUtils'
import Pagination from '../../components/Pagination'

const STATUS_BADGES = {
  pending:   'status-badge inactive',
  confirmed: 'status-badge active',
  completed: 'status-badge role-blue',
  cancelled: 'status-badge danger',
}

function RescheduleModal({ appointment, onClose, onRescheduled }) {
  const [date, setDate]       = useState('')
  const [slots, setSlots]     = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [saving, setSaving]   = useState(false)

  const today = new Date().toISOString().split('T')[0]

  const loadSlots = useCallback(async () => {
    if (!date) return
    setLoadingSlots(true); setSlots([]); setSelectedSlot(null)
    try {
      const { data } = await appointmentsApi.slots({ date, staff_id: appointment.staff_id, duration: 30 })
      setSlots(data.slots || [])
    } catch { toast.error('Failed to load slots.') }
    finally { setLoadingSlots(false) }
  }, [date, appointment.staff_id])

  useEffect(() => { loadSlots() }, [loadSlots])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!selectedSlot) return
    setSaving(true)
    try {
      const { data } = await appointmentsApi.reschedule(appointment.id, {
        scheduled_at: selectedSlot.datetime,
      })
      toast.success(data.message)
      onRescheduled(data.appointment)
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to reschedule.')
    } finally { setSaving(false) }
  }

  const availableSlots = slots.filter(s => !s.is_booked)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card">
        <div className="modal-header">
          <h2>Reschedule Appointment</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Select Date</label>
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
                  <button key={slot.datetime} type="button"
                    className={`slot-chip clickable ${selectedSlot?.time === slot.time ? 'active' : ''}`}
                    onClick={() => setSelectedSlot(slot)}>
                    {slot.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving || !selectedSlot}>
              {saving ? <span className="btn-spinner" /> : 'Confirm Reschedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function CancelModal({ appointment, onClose, onCancelled }) {
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault(); setSaving(true)
    try {
      const { data } = await appointmentsApi.updateStatus(appointment.id, {
        status: 'cancelled',
        cancellation_reason: reason,
      })
      toast.success(data.message)
      onCancelled(data.appointment)
    } catch { toast.error('Failed to cancel appointment.') }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card modal-sm">
        <div className="modal-header">
          <h2>Cancel Appointment</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
          <p className="confirm-text">Cancel appointment #{appointment.id} for {appointment.patient?.user?.name}?</p>
          <div className="form-group">
            <label>Cancellation Reason</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)}
              placeholder="e.g. Doctor unavailable, patient request..." rows={3} required />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn-ghost" onClick={onClose}>Back</button>
            <button type="submit" className="btn-danger" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : 'Cancel Appointment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function AppointmentsManagementPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialStatus = searchParams.get('status') || 'all'
  const highlightId   = searchParams.get('highlight')
  const canConsult = user?.role === 'clinic_staff' || (user?.role === 'admin' && Boolean(user?.has_medical_access))
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState(initialStatus) // 'all'|'pending'|'confirmed'|'completed'|'cancelled'
  const [reschedTarget, setReschedTarget] = useState(null)
  const [cancelTarget, setCancelTarget]   = useState(null)
  const [viewRecord, setViewRecord]       = useState(null)
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSize]       = useState(10)
  const [lastPage, setLastPage]       = useState(1)
  const [total, setTotal]             = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const { data } = await appointmentsApi.list({ appointment_type: 'medical', page, per_page: pageSize })
      setAppointments(data.appointments || [])
      setLastPage(data.last_page || 1)
      setTotal(data.total || 0)
      // Mark medical appointments as read for staff/admin and update badge
      try {
        await appointmentsApi.markAllRead({ appointment_type: 'medical' })
        window.dispatchEvent(new Event('appointments-updated'))
      } catch { }
    } catch { toast.error('Failed to load appointments.') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [page, pageSize])

  useEffect(() => {
    if (highlightId && appointments.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`appt-row-${highlightId}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 200)
    }
  }, [highlightId, appointments])

  const handleUpdateStatus = async (id, status) => {
    try {
      const { data } = await appointmentsApi.updateStatus(id, { status })
      setAppointments(p => p.map(a => a.id === id ? data.appointment : a))
      toast.success(`Appointment marked as ${status}.`)
      window.dispatchEvent(new Event('appointments-updated'))
    } catch { toast.error(`Failed to mark appointment as ${status}.`) }
  }

  const handleRescheduled = (updated) => {
    setAppointments(p => p.map(a => a.id === updated.id ? updated : a))
    setReschedTarget(null)
    window.dispatchEvent(new Event('appointments-updated'))
  }

  const handleCancelled = (updated) => {
    setAppointments(p => p.map(a => a.id === updated.id ? updated : a))
    setCancelTarget(null)
    window.dispatchEvent(new Event('appointments-updated'))
  }

  const filtered = appointments.filter(a => {
    if (filter === 'all') return true
    return a.status === filter
  })

  const stats = [
    { value: appointments.filter(a => a.status === 'pending').length,   label: 'Pending' },
    { value: appointments.filter(a => a.status === 'confirmed').length, label: 'Confirmed' },
    { value: appointments.filter(a => a.status === 'completed').length, label: 'Completed' },
  ]

  return (
    <DashboardLayout title="Medical Appointments Dashboard" subtitle="Confirm, reschedule, or cancel patient medical bookings." stats={stats}>
      <div className="page-toolbar">
        <div className="tab-bar" style={{ margin: 0 }}>
          <button className={`tab-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => { setFilter('all'); setPage(1) }}>All</button>
          <button className={`tab-btn ${filter === 'pending' ? 'active' : ''}`} onClick={() => { setFilter('pending'); setPage(1) }}>Pending</button>
          <button className={`tab-btn ${filter === 'confirmed' ? 'active' : ''}`} onClick={() => { setFilter('confirmed'); setPage(1) }}>Confirmed</button>
          <button className={`tab-btn ${filter === 'completed' ? 'active' : ''}`} onClick={() => { setFilter('completed'); setPage(1) }}>Completed</button>
          <button className={`tab-btn ${filter === 'cancelled' ? 'active' : ''}`} onClick={() => { setFilter('cancelled'); setPage(1) }}>Cancelled</button>
        </div>
      </div>

      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No medical appointments match the selected filter.</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scheduled Date & Time</th>
                <th>Patient Name</th>
                <th>Service</th>
                <th>Attending Nurse</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(a => (
                <tr
                  key={a.id}
                  id={`appt-row-${a.id}`}
                  style={String(a.id) === String(highlightId) ? { backgroundColor: 'rgba(59, 130, 246, 0.12)', outline: '2px solid var(--accent)', transition: 'all 0.5s ease' } : {}}
                >
                  <td className="td-name">
                    {formatAppointmentDateTime(a)}
                  </td>
                  <td>{a.patient?.user?.name || 'Deleted User'}</td>
                  <td>{a.service?.name}</td>
                  <td>{a.staff?.name}</td>
                  <td>
                    <span className={STATUS_BADGES[a.status] || 'status-badge inactive'}>
                      {a.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns">
                      {a.status === 'pending' && (
                        <>
                          <button
                            className="btn-primary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                            onClick={() => handleUpdateStatus(a.id, 'confirmed')}
                          >
                            Confirm
                          </button>
                          <button
                            className="btn-secondary"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                            title="Reschedule"
                            onClick={() => setReschedTarget(a)}
                          >
                            Reschedule
                          </button>
                          <button
                            className="btn-danger"
                            style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                            title="Cancel"
                            onClick={() => setCancelTarget(a)}
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {a.status === 'confirmed' && canConsult && (
                        <button
                          className="btn-primary"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                          title="Start patient check-up consultation"
                          onClick={() => navigate(`/clinic/consultations?appointment_id=${a.id}&patient_id=${a.patient_id}`, { state: { appointment: a } })}
                        >
                          Start Consultation
                        </button>
                      )}

                      {a.status === 'completed' && (
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                          onClick={() => {
                            const recordId = a.clinic_record?.id
                            if (recordId) {
                              setViewRecord(recordId)
                            } else {
                              toast.error('Consultation record not found for this appointment.')
                            }
                          }}
                        >
                          View
                        </button>
                      )}

                      {a.status === 'cancelled' && (
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                          {a.cancellation_reason ? `Reason: ${a.cancellation_reason}` : '—'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pagination
        currentPage={page}
        totalPages={lastPage}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
      />

      {reschedTarget && (
        <RescheduleModal
          appointment={reschedTarget}
          onClose={() => setReschedTarget(null)}
          onRescheduled={handleRescheduled}
        />
      )}

      {cancelTarget && (
        <CancelModal
          appointment={cancelTarget}
          onClose={() => setCancelTarget(null)}
          onCancelled={handleCancelled}
        />
      )}

      {viewRecord && (
        <ViewConsultationModal
          recordId={viewRecord}
          onClose={() => setViewRecord(null)}
        />
      )}
    </DashboardLayout>
  )
}
