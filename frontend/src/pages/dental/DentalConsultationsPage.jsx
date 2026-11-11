import { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import { ViewDentalConsultationModal } from '../../components/ViewDentalConsultationModal'
import { DentalConsultationModal } from '../../components/DentalConsultationModal'
import Pagination from '../../components/Pagination'
import Dropdown from '../../components/Dropdown'
import DateRangeFilter from '../../components/DateRangeFilter'
import { defaultRange } from '../../utils/dateRange'
import { dentalApi } from '../../api/dental'
import { servicesApi } from '../../api/services'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../../components/Avatar'
import { serviceLabel } from '../../utils/emptyValue'
import { formatDateLong } from '../../utils/dateUtils'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

export default function DentalConsultationsPage() {
  const { user } = useAuth()
  const isDentist = user?.role === 'dentist'
  const location = useLocation()
  const navigate = useNavigate()
  const prefilledAppt = location.state?.appointment

  const [loading, setLoading] = useState(true)
  const [services, setServices] = useState([])
  const [consultations, setConsultations] = useState([])
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState({ total: 0, today: 0, walkIns: 0, topComplaint: '—' })
  const [filterOptions, setFilterOptions] = useState({ services: [], staff: [] })
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'new'
  const [viewConsultation, setViewConsultation] = useState(null)

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery)
  const [filterService, setFilterService] = useState('all')
  const [filterDentist, setFilterDentist] = useState('all')
  const [range, setRange] = useState(defaultRange)
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // What the new-consultation form starts with: the appointment the dentist came from (if any)
  const [newInitial, setNewInitial] = useState(() => {
    const query = new URLSearchParams(location.search)
    const apptId = prefilledAppt?.id || query.get('appointment_id') || ''
    if (!apptId) return {}
    return {
      patient_id: prefilledAppt?.patient_id || query.get('patient_id') || '',
      appointment_id: apptId,
      service_name: prefilledAppt?.service?.name || '',
      reason_for_visit: prefilledAppt?.notes || '',
    }
  })

  // A new consultation always starts blank. The appointment data above is used once (when the dentist
  // comes from an appointment) and is cleared as soon as the form closes.
  const openNew = () => { setNewInitial({}); setActiveTab('new') }
  const showList = () => { setNewInitial({}); setActiveTab('list') }

  // One shared formatter (utils/dateUtils): the same day as the one chosen in the form
  const formatDate = formatDateLong

  // Filter options and stat cards come from the API; the table is filtered/paginated server-side.
  const distinctServices = useMemo(() => {
    const set = new Set(filterOptions.services || [])
    services.forEach(s => set.add(s.name))
    return Array.from(set).sort()
  }, [filterOptions, services])

  const distinctDentists = filterOptions.staff || []

  const statCards = [
    { value: stats.total, label: 'Total Consultations' },
    { value: stats.today, label: 'Today' },
    { value: stats.walkIns, label: 'Walk-in' },
    { value: stats.topComplaint, label: 'Top Complaint' },
  ]

  const filteredConsultations = consultations
  const totalPages = lastPage

  const activeFilterCount = (filterService !== 'all' ? 1 : 0) +
    (filterDentist !== 'all' ? 1 : 0)

  const load = async () => {
    try {
      setLoading(true)
      const { data } = await dentalApi.listConsultations({
        with_stats: 1,
        page,
        per_page: pageSize,
        ...(range.from && { date_from: range.from }),
        ...(range.to && { date_to: range.to }),
        ...(debouncedSearchQuery.trim() && { search: debouncedSearchQuery.trim() }),
        ...(filterService !== 'all' && { service: filterService }),
        ...(filterDentist !== 'all' && { staff: filterDentist }),
      })
      setConsultations(data.consultations || data.data || [])
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
  }

  const loadServices = async () => {
    try {
      const { data } = await servicesApi.list({ care_type: 'dental' })
      setServices(data.services || [])
    } catch { /* the service filter still works without the catalogue list */ }
  }

  useEffect(() => { load() }, [page, pageSize, range.from, range.to, debouncedSearchQuery, filterService, filterDentist]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setPage(1) }, [debouncedSearchQuery, filterService, filterDentist, range])

  useEffect(() => {
    loadServices()
    // If navigated here from appointments desk, switch to new tab
    if (prefilledAppt || location.state?.appointment) {
      setActiveTab('new')
    }
    // Handle ?appointment_id query param
    const query = new URLSearchParams(location.search)
    const appointmentId = query.get('appointment_id')
    if (appointmentId && !prefilledAppt) {
      setActiveTab('new')
    }
    // Clear state/query after reading
    navigate('/dental/consultations', { replace: true, state: { appointment: prefilledAppt } })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <DashboardLayout
      title="Dental Consultations"
      subtitle="Record patient check-ups, dental findings, and treatment details."
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
        {isDentist && (
          <button
            className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={openNew}
          >
            + New Dental Consultation
          </button>
        )}
      </div>

      {activeTab === 'new' ? (
        <div style={{ width: '100%' }}>
          <DentalConsultationModal
            inline
            initialData={newInitial}
            onClose={showList}
            onSaved={() => { load() }}
          />
        </div>
      ) : (
        <div>
          {/* Date range (shared with Appointments/Reports) */}
          <div style={{ marginBottom: '1rem', maxWidth: '640px' }}>
            <DateRangeFilter value={range} onChange={setRange} />
          </div>

          {/* Search and Filters Toolbar */}
          <div>
            <div className="page-toolbar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
                <input
                  type="text"
                  className="search-input"
                  style={{ width: '100%', boxSizing: 'border-box' }}
                  placeholder="Search by patient name, student ID, or service..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
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

                {/* Filters Dropdown Popover */}
                {filterPopoverOpen && (
                  <div className="filter-popover-card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 100, background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', width: '280px', boxShadow: 'var(--shadow-lg)' }}>
                    <div className="filter-popover-group" style={{ marginBottom: '0.85rem' }}>
                      <div className="filter-popover-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.35rem' }}>
                        Dental Service
                      </div>
                      <Dropdown
                        variant="filter"
                        value={filterService}
                        onChange={setFilterService}
                        options={[{ value: 'all', label: 'All Dental Services' }, ...distinctServices.map(s => ({ value: s, label: s }))]}
                      />
                    </div>

                    {distinctDentists.length > 1 && (
                      <div className="filter-popover-group" style={{ marginBottom: '0.85rem' }}>
                        <div className="filter-popover-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.35rem' }}>
                          Attending Dentist
                        </div>
                        <Dropdown
                          variant="filter"
                          value={filterDentist}
                          onChange={setFilterDentist}
                          options={[{ value: 'all', label: 'All Dentists' }, ...distinctDentists.map(d => ({ value: d, label: d }))]}
                        />
                      </div>
                    )}

                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        style={{
                          width: '100%',
                          padding: '0.4rem',
                          background: 'none',
                          border: 'none',
                          color: 'var(--accent)',
                          fontWeight: 600,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          textAlign: 'center',
                          borderTop: '1px solid var(--border)',
                          paddingTop: '0.6rem',
                          marginTop: '0.4rem',
                        }}
                        onClick={() => {
                          setFilterService('all')
                          setFilterDentist('all')
                        }}
                      >
                        Reset all filters
                      </button>
                    )}
                  </div>
                )}
              </div>

              {(searchQuery || activeFilterCount > 0) && (
                <button
                  type="button"
                  className="btn-ghost"
                  style={{ fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}
                  onClick={() => {
                    setSearchQuery('')
                    setFilterService('all')
                    setFilterDentist('all')
                  }}
                >
                  Clear All
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          {loading ? (
            <div className="table-loading"><span className="loader-ring" /></div>
          ) : filteredConsultations.length === 0 ? (
            <div className="empty-state" style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '3rem 1.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                {searchQuery || activeFilterCount > 0
                  ? 'No dental consultations match your search or filter criteria.'
                  : 'No dental consultations recorded yet.'}
              </p>
              {(searchQuery || activeFilterCount > 0) && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSearchQuery('')
                    setFilterService('all')
                    setFilterDentist('all')
                  }}
                >
                  Clear Filters
                </button>
              )}
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
                      <th>Attending Dentist</th>
                      <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consultations.map((c) => {
                      const patientUser = c.patient?.user || {}
                      const serviceName = serviceLabel(c)
                      const status = c.status || 'completed'
                      return (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                            {formatDate(c.consultation_date)}
                          </td>
                          <td className="td-name" style={{ whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <Avatar src={patientUser.avatar_url} name={patientUser.name} size={30} />
                            <div>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                              {patientUser.name || 'Patient'}
                            </div>
                            {patientUser.student_id ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                ID: {patientUser.student_id}
                              </div>
                            ) : patientUser.email ? (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {patientUser.email}
                              </div>
                            ) : null}
                            </div>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                            {serviceName}
                          </td>
                          <td>
                            <span className={`status-badge ${status}`} style={{ textTransform: 'capitalize' }}>
                              {status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                              <Avatar src={c.dentist?.avatar_url} name={c.dentist?.name} size={24} />
                              {c.dentist?.name || 'Dentist'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                              onClick={() => setViewConsultation(c)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <Pagination
                  currentPage={page}
                  totalPages={totalPages}
                  totalItems={total}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize)
                    setPage(1)
                  }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {viewConsultation && (
        <ViewDentalConsultationModal
          record={viewConsultation}
          onClose={() => setViewConsultation(null)}
        />
      )}
    </DashboardLayout>
  )
}
