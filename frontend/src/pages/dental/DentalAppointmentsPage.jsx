import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { ViewDentalConsultationModal } from '../../components/ViewDentalConsultationModal'
import { DentalConsultationModal } from '../../components/DentalConsultationModal'
import { appointmentsApi } from '../../api/appointments'
import { useAuth } from '../../context/AuthContext'
import { toast } from 'react-hot-toast'
import { formatAppointmentDateTime } from '../../utils/dateUtils'
import Pagination from '../../components/Pagination'
import DateRangeFilter from '../../components/DateRangeFilter'
import { defaultRange } from '../../utils/dateRange'
import Avatar from '../../components/Avatar'
import { EMPTY } from '../../utils/emptyValue'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const STATUS_BADGES = {
  pending:   'status-badge inactive',
  confirmed: 'status-badge active',
  completed: 'status-badge role-blue',
  cancelled: 'status-badge danger',
  no_show:   'status-badge inactive',
}

export default function DentalAppointmentsPage() {
  const navigate                              = useNavigate()
  const { user }                              = useAuth()
  const [searchParams]                        = useSearchParams()
  const initialStatus                         = searchParams.get('status') || 'all'
  const highlightId                           = searchParams.get('highlight')
  const canConsult                            = user?.role === 'dentist' || (user?.role === 'admin' && Boolean(user?.has_dental_access))
  const [loading, setLoading]                 = useState(true)
  const [appointments, setAppointments]       = useState([])
  const [filterStatus, setFilterStatus]       = useState(initialStatus)
  const [searchQuery, setSearchQuery]         = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery)
  const [viewRecord, setViewRecord]           = useState(null)
  const [editModal, setEditModal]             = useState(null)
  const [page, setPage]                       = useState(1)
  const [pageSize, setPageSize]               = useState(10)
  const [lastPage, setLastPage]               = useState(1)
  const [total, setTotal]                     = useState(0)
  const [statusCounts, setStatusCounts]       = useState({})
  const [range, setRange]                     = useState(defaultRange)

  useEffect(() => {
    fetchAppointments()
  }, [page, pageSize, filterStatus, debouncedSearchQuery, range.from, range.to])

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
      const res = await appointmentsApi.list({
        appointment_type: 'dental',
        page,
        per_page: pageSize,
        ...(filterStatus !== 'all' && { status: filterStatus }),
        ...(debouncedSearchQuery.trim() && { search: debouncedSearchQuery.trim() }),
        ...(range.from && { date_from: range.from }),
        ...(range.to && { date_to: range.to }),
      })
      setAppointments(res.data.appointments || [])
      setLastPage(res.data.last_page || 1)
      setTotal(res.data.total || 0)
      setStatusCounts(res.data.status_counts || {})
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

  const handleEditSaved = (savedRecord) => {
    // Update appointment's dental_consultation with new data
    setAppointments(p => p.map(a => a.dental_consultation?.id === savedRecord.id ? { ...a, dental_consultation: savedRecord } : a))
    setViewRecord(null)
    setEditModal(null)
  }

  // The list is already filtered server-side (status + search), so render it directly
  const filteredAppointments = appointments

  // Counts come from the API for the whole desk, not just the current page
  const stats = editModal ? [] : [
    { value: statusCounts.pending   ?? 0, label: 'Pending' },
    { value: statusCounts.confirmed ?? 0, label: 'Confirmed' },
    { value: statusCounts.completed ?? 0, label: 'Completed' },
    { value: statusCounts.cancelled ?? 0, label: 'Cancelled' },
    { value: statusCounts.no_show   ?? 0, label: 'No Show' },
  ]

  return (
    <DashboardLayout
      title="Dental Appointments Desk"
      subtitle="Confirm, complete, reschedule, or cancel dental patient bookings."
      stats={stats}
    >
      {editModal ? (
        // Edit form: normal scrollable layout
        <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
          <DentalConsultationModal
            initialData={editModal}
            onClose={() => setEditModal(null)}
            onSaved={handleEditSaved}
            inline
          />
        </div>
      ) : (
        // List view: fixed layout
        <div className="page-fixed-list fixed-list-layout dr-page">
        {/* Fixed Toolbar */}
        <div className="fixed-list-top">
          {/* Date range (shared with Consultations/Reports) + admin type filter */}
          <div style={{ marginBottom: '0.75rem' }}>
            <DateRangeFilter value={range} onChange={setRange} />
          </div>
          <div className="page-toolbar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search by patient name or student ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: '260px' }}
            />

            <div className="tab-bar" style={{ margin: 0 }}>
              {['all', 'pending', 'confirmed', 'completed', 'cancelled', 'no_show'].map((st) => (
                <button
                  key={st}
                  className={`tab-btn ${filterStatus === st ? 'active' : ''}`}
                  onClick={() => { setFilterStatus(st); setPage(1) }}
                  style={{ textTransform: 'capitalize' }}
                >
                  {st === 'no_show' ? 'No Show' : st}
                </button>
              ))}
            </div>

            <button onClick={fetchAppointments} className="btn-secondary">
              Refresh
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="fixed-list-body">
          <div className="fixed-list-scroll">
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
                      <th>Service</th>
                      <th>Attending Dentist</th>
                      <th>Status</th>
                      <th>Actions</th>
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
                        <td>{appt.service?.name || 'Dental Service'}</td>
                        <td>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Avatar src={appt.staff?.avatar_url} name={appt.staff?.name} size={28} />
                            {appt.staff?.name || 'Dentist'}
                          </span>
                        </td>
                        <td>
                          <span className={STATUS_BADGES[appt.status] || 'status-badge pending'}>
                            {appt.status}
                          </span>
                        </td>
                        <td>
                          <div className="action-btns">
                            {appt.status === 'pending' && (
                              <>
                                <button
                                  className="btn-primary"
                                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                                  onClick={() => handleStatusUpdate(appt.id, 'confirmed')}
                                >
                                  Confirm
                                </button>
                                <button
                                  className="btn-secondary"
                                  style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                                  title="Cancel"
                                  onClick={() => handleStatusUpdate(appt.id, 'cancelled')}
                                >
                                  Cancel
                                </button>
                              </>
                            )}

                            {appt.status === 'confirmed' && (
                              <button
                                onClick={() => navigate(`/dental/consultations?appointment_id=${appt.id}&patient_id=${appt.patient_id}`, { state: { appointment: appt } })}
                                className="btn-primary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                              >
                                Start Consultation
                              </button>
                            )}

                            {appt.status === 'completed' && (
                              <button
                                className="btn-secondary"
                                style={{ padding: '0.3rem 0.65rem', fontSize: '0.78rem' }}
                                onClick={() => {
                                  if (appt.dental_consultation) {
                                    setViewRecord(appt.dental_consultation)
                                  } else {
                                    toast.error('Dental consultation record not found for this appointment.')
                                  }
                                }}
                              >
                                View
                              </button>
                            )}

                            {appt.status === 'cancelled' && (
                              <span className="text-muted" style={{ fontSize: '0.8rem' }}>
                                {appt.cancellation_reason ? `Reason: ${appt.cancellation_reason}` : EMPTY}
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
          </div>
        </div>

        {/* Pinned Pagination */}
        <div className="fixed-list-bottom">
          <Pagination
            currentPage={page}
            totalPages={lastPage}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
          />
        </div>
        </div>
      )}

      {viewRecord && (
        <ViewDentalConsultationModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
          onEdit={canConsult ? (rec) => {
            setViewRecord(null)
            setEditModal(rec)
          } : null}
        />
      )}
    </DashboardLayout>
  )
}
