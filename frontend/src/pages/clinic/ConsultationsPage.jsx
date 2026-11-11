import { useEffect, useState, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import { ConsultationModal } from '../../components/ConsultationModal'
import { ViewConsultationModal } from '../../components/ViewConsultationModal'
import { recordsApi } from '../../api/records'
import { useAuth } from '../../context/AuthContext'
import Pagination from '../../components/Pagination'
import Dropdown from '../../components/Dropdown'
import Avatar from '../../components/Avatar'
import DateRangeFilter from '../../components/DateRangeFilter'
import { defaultRange } from '../../utils/dateRange'
import { serviceNameOf } from '../../utils/emptyValue'
import { formatDateLong, toDateKey } from '../../utils/dateUtils'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

// One row shape for medical and dental consultations so the list, stats and filters
// treat both care types identically (admin sees them merged, everyone else one type).
function normalize(row, type) {
  const isMedical = type === 'medical'
  const dateField = isMedical ? row.visit_date : row.consultation_date
  const staff = isMedical ? row.created_by : row.dentist
  const patientUser = row.patient?.user || {}
  const serviceName = serviceNameOf(row)
  const complaint = (row.complaint_category || '').trim()
  return {
    key: `${type}-${row.id}`,
    type,
    raw: row,
    date: toDateKey(dateField) || toDateKey(row.created_at) || '',
    displayDate: dateField || row.created_at,
    patientUser,
    serviceName,
    status: row.status || 'completed',
    staffName: staff?.name || (isMedical ? 'Clinic Staff' : 'Dentist'),
    staffAvatar: staff?.avatar_url,
    walkIn: row.appointment_id == null,
    complaint: complaint || 'Others',
    searchText: [
      patientUser.name, patientUser.student_id, patientUser.email,
      serviceName, row.diagnosis, row.assessment, row.chief_complaint,
      row.reason_for_visit, row.treatment, row.treatment_performed,
      row.dental_findings, staff?.name, complaint,
    ].filter(Boolean).join(' ').toLowerCase(),
  }
}

export default function ConsultationsPage() {
  const { user } = useAuth()
  const isNurse = user?.role === 'clinic_staff'
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total: 0, today: 0, walkIns: 0, topComplaint: '—' })
  const [filterOptions, setFilterOptions] = useState({ services: [], staff: [] })
  const [search, setSearch] = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [filterService, setFilterService] = useState('all')
  const [filterStaff, setFilterStaff] = useState('all')
  const [range, setRange] = useState(defaultRange)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'new'
  const [modal, setModal] = useState(null) // null | record (for edit)
  const [viewRecord, setViewRecord] = useState(null) // medical record

  const location = useLocation()
  const navigate = useNavigate()

  // One shared formatter (utils/dateUtils): the same day as the one chosen in the form
  const formatDate = formatDateLong

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await recordsApi.list({
        with_stats: 1,
        page,
        per_page: pageSize,
        ...(range.from && { date_from: range.from }),
        ...(range.to && { date_to: range.to }),
        ...(debouncedSearch.trim() && { search: debouncedSearch.trim() }),
        ...(filterService !== 'all' && { service: filterService }),
        ...(filterStaff !== 'all' && { staff: filterStaff }),
      })
      const medical = data.records || data.data || []
      setRows(medical.map(r => normalize(r, 'medical')))
      setLastPage(data.last_page || 1)
      setTotal(data.total || 0)
      if (data.stats) {
        setStats({
          total: data.stats.total ?? 0,
          today: data.stats.today ?? 0,
          walkIns: data.stats.walk_ins ?? 0,
          topComplaint: data.stats.top_complaint || '—',
        })
        setFilterOptions(data.stats.filter_options || { services: [], staff: [] })
      }
    } catch {
      toast.error('Failed to load consultation records.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, range.from, range.to, debouncedSearch, filterService, filterStaff])

  useEffect(() => { load() }, [load])

  // Handle navigation from "Start Consultation" on Appointments page
  useEffect(() => {
    const query = new URLSearchParams(location.search)
    const appointmentId = query.get('appointment_id')
    const patientId = query.get('patient_id')
    const locAppt = location.state?.appointment

    if (locAppt || appointmentId || patientId) {
      setActiveTab('new')
      if (locAppt) {
        setModal({
          appointment_id: locAppt.id,
          patient_id: locAppt.patient_id,
          service_name: locAppt.service?.name || '',
          chief_complaint: locAppt.notes || '',
        })
      } else {
        setModal({
          appointment_id: appointmentId ? parseInt(appointmentId) : '',
          patient_id: patientId ? parseInt(patientId) : '',
        })
      }
      navigate('/clinic/consultations', { replace: true })
    }
  }, [location.search, location.state, navigate])

  // A new consultation always starts blank. Only "Start Consultation" from an appointment (handled
  // above) or "Edit" hands the form any data, and that data is cleared again as soon as the form closes.
  const openNew = () => { setModal(null); setActiveTab('new') }
  const showList = () => { setModal(null); setActiveTab('list') }

  const handleSaved = () => {
    setModal(null)
    setActiveTab('list')
    toast.success('Consultation saved successfully.')
    load()
  }

  // Filter options and stat cards come from the API (range-scoped stats, all-rows options).
  const distinctServices = filterOptions.services
  const distinctStaff = filterOptions.staff

  // The table is filtered and paginated server-side; `rows` is the current page.
  const filteredRows = rows

  useEffect(() => { setPage(1) }, [debouncedSearch, filterService, filterStaff, range])

  const activeFilterCount = (filterService !== 'all' ? 1 : 0) + (filterStaff !== 'all' ? 1 : 0)

  const resetFilters = () => {
    setSearch('')
    setFilterService('all')
    setFilterStaff('all')
  }

  const statCards = [
    { value: stats.total, label: 'Total Consultations' },
    { value: stats.today, label: 'Today' },
    { value: stats.walkIns, label: 'Walk-in' },
    { value: stats.topComplaint, label: 'Top Complaint' },
  ]

  return (
    <DashboardLayout
      title="Medical Consultations"
      subtitle="Record patient check-ups, vital signs, clinical findings, and treatment details."
      stats={activeTab === 'list' ? statCards : []}
    >
      {/* Navigation Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={showList}
        >
          Consultation Logs
        </button>
        {isNurse && (
          <button
            className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={openNew}
          >
            + New Medical Consultation
          </button>
        )}
      </div>

      {activeTab === 'new' ? (
        <div style={{ width: '100%' }}>
          <ConsultationModal
            initialData={modal}
            onClose={showList}
            onSaved={handleSaved}
            inline
          />
        </div>
      ) : (
        <div>
          {/* Date range (shared with Appointments/Reports) */}
          <div style={{ marginBottom: '1rem', maxWidth: '640px' }}>
            <DateRangeFilter value={range} onChange={setRange} />
          </div>

          {/* Search and Filters Toolbar */}
          <div className="page-toolbar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: '1rem' }}>
            <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="Search by patient name, student ID, or service..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '2px 6px',
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`filter-btn-outline ${activeFilterCount > 0 ? 'active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-full)',
                  border: activeFilterCount > 0 ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: activeFilterCount > 0 ? 'var(--accent-light)' : '#FFFFFF',
                  color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
                onClick={() => setFilterPopoverOpen(!filterPopoverOpen)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="status-tab-count" style={{ background: 'var(--accent)', color: '#fff', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem' }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {filterPopoverOpen && (
                <div
                  className="filter-popover-card"
                  style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 100, background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', width: '280px', boxShadow: 'var(--shadow-lg)' }}
                >
                  <div className="filter-popover-group" style={{ marginBottom: '0.85rem' }}>
                    <div className="filter-popover-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.35rem' }}>
                      Clinic Service
                    </div>
                    <Dropdown
                      variant="filter"
                      value={filterService}
                      onChange={setFilterService}
                      options={[{ value: 'all', label: 'All Services' }, ...distinctServices.map(s => ({ value: s, label: s }))]}
                    />
                  </div>

                  {distinctStaff.length > 1 && (
                    <div className="filter-popover-group" style={{ marginBottom: '0.85rem' }}>
                      <div className="filter-popover-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.35rem' }}>
                        Attending Nurse / Staff
                      </div>
                      <Dropdown
                        variant="filter"
                        value={filterStaff}
                        onChange={setFilterStaff}
                        options={[{ value: 'all', label: 'All Staff' }, ...distinctStaff.map(d => ({ value: d, label: d }))]}
                      />
                    </div>
                  )}

                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      style={{
                        width: '100%', padding: '0.4rem', background: 'none', border: 'none',
                        color: 'var(--accent)', fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer',
                        textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', marginTop: '0.4rem',
                      }}
                      onClick={resetFilters}
                    >
                      Reset all filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {(search || activeFilterCount > 0) && (
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}
                onClick={() => { resetFilters(); setSearch('') }}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Loading/Empty/Body Logic */}
          {loading ? (
            <div className="table-loading"><span className="loader-ring" /></div>
          ) : filteredRows.length === 0 ? (
            <div className="empty-state" style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '3rem 1.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                {search || activeFilterCount > 0
                  ? 'No consultations match your search or filter criteria.'
                  : 'No consultations recorded yet.'}
              </p>
              {(search || activeFilterCount > 0) ? (
                <button type="button" className="btn-secondary" onClick={() => { resetFilters(); setSearch('') }}>
                  Clear Filters
                </button>
              ) : isNurse ? (
                <button className="btn-primary" onClick={openNew}>
                  Start First Consultation
                </button>
              ) : null}
            </div>
          ) : (
            <>
              <div className="data-table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '140px' }}>Date</th>
                      <th>Patient</th>
                      <th>Service</th>
                      <th style={{ width: '130px' }}>Status</th>
                      <th>Attending Nurse</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map(r => (
                      <tr key={r.key}>
                        <td style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {formatDate(r.displayDate)}
                        </td>
                        <td className="td-name" style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <Avatar src={r.patientUser.avatar_url} name={r.patientUser.name} size={30} />
                            <div>
                              <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                                {r.patientUser.name || 'Patient'}
                              </div>
                              {r.patientUser.student_id ? (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  ID: {r.patientUser.student_id}
                                </div>
                              ) : r.patientUser.email ? (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                  {r.patientUser.email}
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                          {r.serviceName}
                        </td>
                        <td>
                          <span className={`status-badge ${r.status}`} style={{ textTransform: 'capitalize' }}>
                            {r.status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Avatar src={r.staffAvatar} name={r.staffName} size={24} />
                            {r.staffName}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                            onClick={() => setViewRecord(r.raw)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <Pagination
                  currentPage={page}
                  totalPages={lastPage}
                  totalItems={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(s) => { setPageSize(s); setPage(1) }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {viewRecord && (
        <ViewConsultationModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
          onEdit={isNurse ? (rec) => {
            setViewRecord(null)   // close the details window, otherwise it stays on top of the edit form
            setModal(rec)
            setActiveTab('new')
          } : null}
        />
      )}
    </DashboardLayout>
  )
}
