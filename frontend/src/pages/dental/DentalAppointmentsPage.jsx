import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { ViewDentalConsultationModal } from '../../components/ViewDentalConsultationModal'
import { appointmentsApi } from '../../api/appointments'
import { toast } from 'react-hot-toast'
import { formatAppointmentDateTime } from '../../utils/dateUtils'
import Pagination from '../../components/Pagination'
import Avatar from '../../components/Avatar'

const STATUS_BADGES = {
  pending:   'status-badge pending',
  confirmed: 'status-badge confirmed',
  completed: 'status-badge completed',
  cancelled: 'status-badge cancelled',
}

export default function DentalAppointmentsPage() {
  const navigate                              = useNavigate()
  const [searchParams]                        = useSearchParams()
  const initialStatus                         = searchParams.get('status') || 'all'
  const highlightId                           = searchParams.get('highlight')
  const [loading, setLoading]                 = useState(true)
  const [appointments, setAppointments]       = useState([])
  const [filterStatus, setFilterStatus]       = useState(initialStatus)
  const [searchQuery, setSearchQuery]         = useState('')
  const [viewRecord, setViewRecord]           = useState(null)
  const [page, setPage]                       = useState(1)
  const [pageSize, setPageSize]               = useState(10)
  const [lastPage, setLastPage]               = useState(1)
  const [total, setTotal]                     = useState(0)

  useEffect(() => {
    fetchAppointments()
  }, [page, pageSize])

  useEffect(() => {
    if (highlightId && appointments.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`dental-appt-row-${highlightId}`)
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }, 200)
    }
  }, [highlightId, appointments])

  const fetchAppointments = async () => {
    try {
      setLoading(true)
      const res = await appointmentsApi.list({ appointment_type: 'dental', page, per_page: pageSize })
      setAppointments(res.data.appointments || [])
      setLastPage(res.data.last_page || 1)
      setTotal(res.data.total || 0)
      // Mark dental appointments as read for dentist/admin and update badge
      try {
        await appointmentsApi.markAllRead({ appointment_type: 'dental' })
        window.dispatchEvent(new Event('appointments-updated'))
      } catch { }
    } catch (err) {
      toast.error('Failed to load dental appointments.')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusUpdate = async (id, status) => {
    try {
      await appointmentsApi.updateStatus(id, { status })
      toast.success(`Appointment status updated to ${status}.`)
      window.dispatchEvent(new Event('appointments-updated'))
      fetchAppointments()
    } catch (err) {
      toast.error('Failed to update appointment status.')
    }
  }

  const filteredAppointments = appointments.filter((a) => {
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus
    const patientName = a.patient?.user?.name || ''
    const studentId = a.patient?.user?.student_id || ''
    const matchesSearch = patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          studentId.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  return (
    <DashboardLayout
      title="Dental Appointments Desk"
      subtitle="Confirm, complete, reschedule, or cancel dental patient bookings."
    >
      {/* Page Toolbar */}
      <div className="page-toolbar" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <input
          type="text"
          className="search-input"
          placeholder="Search by patient name or student ID..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ flex: 1, minWidth: '260px' }}
        />

        <div className="tab-bar" style={{ margin: 0 }}>
          {['all', 'pending', 'confirmed', 'completed', 'cancelled'].map((st) => (
            <button
              key={st}
              className={`tab-btn ${filterStatus === st ? 'active' : ''}`}
              onClick={() => { setFilterStatus(st); setPage(1) }}
              style={{ textTransform: 'capitalize' }}
            >
              {st}
            </button>
          ))}
        </div>

        <button onClick={fetchAppointments} className="btn-secondary">
          Refresh
        </button>
      </div>

      {/* Main Table Card */}
      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : filteredAppointments.length === 0 ? (
        <div className="empty-state">
          <p>No dental appointments match your criteria.</p>
        </div>
      ) : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scheduled Date & Time</th>
                <th>Patient Name</th>
                <th>Student / Staff ID</th>
                <th>Service Requested</th>
                <th>Reason / Notes</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAppointments.map((appt) => (
                <tr
                  key={appt.id}
                  id={`dental-appt-row-${appt.id}`}
                  style={String(appt.id) === String(highlightId) ? { backgroundColor: 'rgba(59, 130, 246, 0.12)', outline: '2px solid var(--accent)', transition: 'all 0.5s ease' } : {}}
                >
                  <td className="td-name">
                    {formatAppointmentDateTime(appt)}
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Avatar src={appt.patient?.user?.avatar_url} name={appt.patient?.user?.name} size={28} />
                      {appt.patient?.user?.name || 'Patient'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>
                    {appt.patient?.user?.student_id || appt.patient?.user?.department || '—'}
                  </td>
                  <td>{appt.service?.name || 'Dental Service'}</td>
                  <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{appt.notes || '—'}</td>
                  <td>
                    <span className={STATUS_BADGES[appt.status] || 'status-badge pending'}>
                      {appt.status}
                    </span>
                  </td>
                  <td>
                    <div className="action-btns" style={{ justifyContent: 'flex-end' }}>
                      {appt.status === 'pending' && (
                        <>
                          <button
                            onClick={() => handleStatusUpdate(appt.id, 'confirmed')}
                            className="btn-primary"
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                          >
                            Confirm
                          </button>
                          <button
                            onClick={() => handleStatusUpdate(appt.id, 'cancelled')}
                            className="btn-danger"
                            style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {appt.status === 'confirmed' && (
                        <button
                          onClick={() => navigate(`/dental/consultations?appointment_id=${appt.id}&patient_id=${appt.patient_id}`, { state: { appointment: appt } })}
                          className="btn-primary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                        >
                          Start Consultation
                        </button>
                      )}

                      {appt.status === 'completed' && (
                        <button
                          onClick={() => {
                            if (appt.dental_consultation) {
                              setViewRecord(appt.dental_consultation)
                            } else {
                              toast.error('Dental consultation record not found for this appointment.')
                            }
                          }}
                          className="btn-secondary"
                          style={{ padding: '0.35rem 0.7rem', fontSize: '0.78rem' }}
                        >
                          View
                        </button>
                      )}

                      {appt.status === 'cancelled' && (
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}>—</span>
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

      {viewRecord && (
        <ViewDentalConsultationModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
        />
      )}
    </DashboardLayout>
  )
}
