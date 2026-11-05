import { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import PrintableRecord from '../../components/PrintableRecord'
import { ViewDentalConsultationModal } from '../../components/ViewDentalConsultationModal'
import { DentalConsultationModal } from '../../components/DentalConsultationModal'
import Pagination from '../../components/Pagination'
import DateInput from '../../components/DateInput'
import Dropdown from '../../components/Dropdown'
import { dentalApi } from '../../api/dental'
import { servicesApi } from '../../api/services'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import Avatar from '../../components/Avatar'
import { serviceLabel, serviceNameOf } from '../../utils/emptyValue'
import { formatDateLong, toDateKey } from '../../utils/dateUtils'
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
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'new'
  const [viewConsultation, setViewConsultation] = useState(null)

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const debouncedSearchQuery = useDebouncedValue(searchQuery)
  const [filterService, setFilterService] = useState('all')
  const [filterDentist, setFilterDentist] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
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

  const distinctServices = useMemo(() => {
    const set = new Set()
    consultations.forEach(c => {
      const s = serviceNameOf(c)
      if (s) set.add(s)
    })
    services.forEach(s => set.add(s.name))
    return Array.from(set).sort()
  }, [consultations, services])

  const distinctDentists = useMemo(() => {
    const set = new Set()
    consultations.forEach(c => {
      if (c.dentist?.name) set.add(c.dentist.name)
    })
    return Array.from(set).sort()
  }, [consultations])

  const filteredConsultations = useMemo(() => {
    return consultations.filter(c => {
      // 1. Search Query
      if (debouncedSearchQuery.trim()) {
        const q = debouncedSearchQuery.toLowerCase().trim()
        const patientName = (c.patient?.user?.name || '').toLowerCase()
        const studentId = (c.patient?.user?.student_id || '').toLowerCase()
        const serviceName = serviceNameOf(c).toLowerCase()
        const reason = (c.reason_for_visit || '').toLowerCase()
        const findings = (c.dental_findings || '').toLowerCase()
        const treatment = (c.treatment_performed || '').toLowerCase()
        const dentistName = (c.dentist?.name || '').toLowerCase()
        const matches = patientName.includes(q) ||
          studentId.includes(q) ||
          serviceName.includes(q) ||
          reason.includes(q) ||
          findings.includes(q) ||
          treatment.includes(q) ||
          dentistName.includes(q)
        if (!matches) return false
      }

      // 2. Service Filter
      if (filterService !== 'all') {
        const serviceName = serviceNameOf(c)
        if (serviceName !== filterService) return false
      }

      // 3. Dentist Filter
      if (filterDentist !== 'all') {
        const dentistName = c.dentist?.name || ''
        if (dentistName !== filterDentist) return false
      }

      // 4. Date Range Filter
      if (dateFrom || dateTo) {
        const cDate = toDateKey(c.consultation_date) || ''
        if (dateFrom && cDate < dateFrom) return false
        if (dateTo && cDate > dateTo) return false
      }

      return true
    })
  }, [consultations, debouncedSearchQuery, filterService, filterDentist, dateFrom, dateTo])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearchQuery, filterService, filterDentist, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filteredConsultations.length / pageSize))
  const paginatedConsultations = filteredConsultations.slice((page - 1) * pageSize, page * pageSize)

  const activeFilterCount = (filterService !== 'all' ? 1 : 0) +
    (filterDentist !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  useEffect(() => {
    loadInitialData()
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

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [cRes, sRes] = await Promise.all([
        dentalApi.listConsultations(),
        servicesApi.list({ care_type: 'dental' }),
      ])
      setConsultations(cRes.data.consultations || [])
      setServices(sRes.data.services || [])
    } catch {
      toast.error('Failed to load consultation records.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <DashboardLayout
      title="Dental Consultations"
      subtitle="Record patient check-ups, dental findings, and treatment details."
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
            onSaved={() => { loadInitialData() }}
          />
        </div>
      ) : (
        /* Consultation Logs Table with Search and Filters */
        <div>
          {/* Search and Filters Toolbar */}
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

                  <div className="filter-popover-group" style={{ marginBottom: '0.85rem' }}>
                    <div className="filter-popover-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.35rem' }}>
                      Date Range
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <DateInput
                        label="From"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        max={dateTo || undefined}
                        style={{ width: '100%' }}
                      />
                      <DateInput
                        label="To"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        min={dateFrom || undefined}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

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
                        setDateFrom('')
                        setDateTo('')
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
                  setDateFrom('')
                  setDateTo('')
                }}
              >
                Clear All
              </button>
            )}
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
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="data-table-wrap" style={{ overflowX: 'auto', width: '100%', boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-md)' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Date</th>
                    <th>Patient</th>
                    <th>Service</th>
                    <th style={{ width: '130px' }}>Status</th>
                    <th>Attending Dentist</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedConsultations.map((c) => {
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

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredConsultations.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize)
                  setPage(1)
                }}
              />
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
