import { useEffect, useState, useCallback, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import PrintableRecord from '../../components/PrintableRecord'
import { ConsultationModal } from '../../components/ConsultationModal'
import { ViewConsultationModal } from '../../components/ViewConsultationModal'
import { recordsApi } from '../../api/records'
import { appointmentsApi } from '../../api/appointments'
import { servicesApi } from '../../api/services'
import { useAuth } from '../../context/AuthContext'
import Pagination from '../../components/Pagination'
import DateInput from '../../components/DateInput'
import Dropdown from '../../components/Dropdown'
import Avatar from '../../components/Avatar'

export default function ConsultationsPage() {
  const { user } = useAuth()
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [lastPage, setLastPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [filterService, setFilterService] = useState('all')
  const [filterStaff, setFilterStaff] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'new'
  const [modal, setModal] = useState(null) // null | record (for edit)
  const [viewRecord, setViewRecord] = useState(null)

  const location = useLocation()
  const navigate = useNavigate()

  const formatDate = (dateStr) => {
    if (!dateStr) return 'â€”'
    const clean = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
    const d = new Date(clean + 'T00:00:00')
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleDateString('en-PH', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const distinctServices = useMemo(() => {
    const set = new Set()
    records.forEach(r => {
      const svc = r.appointment?.service?.name || r.service_name
      if (svc) set.add(svc)
    })
    return Array.from(set).sort()
  }, [records])

  const distinctStaff = useMemo(() => {
    const set = new Set()
    records.forEach(r => {
      if (r.created_by?.name) set.add(r.created_by.name)
    })
    return Array.from(set).sort()
  }, [records])

  const filteredRecords = useMemo(() => {
    return records.filter(r => {
      // 1. Live search
      if (search) {
        const q = search.toLowerCase()
        const patientUser = r.patient?.user || {}
        const haystack = [
          patientUser.name,
          patientUser.student_id,
          r.appointment?.service?.name,
          r.service_name,
          r.diagnosis,
          r.assessment,
          r.chief_complaint,
          r.treatment,
          r.created_by?.name,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!haystack.includes(q)) return false
      }

      // 2. Service Filter
      if (filterService !== 'all') {
        const sName = r.appointment?.service?.name || r.service_name || ''
        if (sName !== filterService) return false
      }

      // 3. Staff Filter
      if (filterStaff !== 'all') {
        if ((r.created_by?.name || '') !== filterStaff) return false
      }

      // 4. Date Range Filter
      if (dateFrom || dateTo) {
        const rDate = typeof r.visit_date === 'string' && r.visit_date.includes('T')
          ? r.visit_date.split('T')[0]
          : r.visit_date
        if (dateFrom && rDate < dateFrom) return false
        if (dateTo && rDate > dateTo) return false
      }

      return true
    })
  }, [records, search, filterService, filterStaff, dateFrom, dateTo])

  const activeFilterCount = (filterService !== 'all' ? 1 : 0) +
    (filterStaff !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  const resetFilters = () => {
    setSearch('')
    setFilterService('all')
    setFilterStaff('all')
    setDateFrom('')
    setDateTo('')
  }

  const isNurse = user?.role === 'clinic_staff'

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await recordsApi.list({ page, per_page: pageSize })
      setRecords(data.records || [])
      setLastPage(data.last_page || 1)
      setTotal(data.total || 0)
    } catch {
      toast.error('Failed to load consultation records.')
    } finally {
      setLoading(false)
    }
  }, [page, pageSize])

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

  const handleSaved = (saved, isEdit) => {
    if (isEdit) {
      setRecords(p => p.map(r => r.id === saved.id ? saved : r))
    } else {
      setRecords(p => [saved, ...p])
    }
    setModal(null)
    setActiveTab('list')
    toast.success('Consultation saved successfully.')
  }

  return (
    <DashboardLayout
      title="Medical Consultations"
      subtitle="Record patient check-ups, vital signs, clinical findings, and treatment details."
    >
      {/* Navigation Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          Consultation Logs
        </button>
        {isNurse && (
          <button
            className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => { setModal(null); setActiveTab('new') }}
          >
            + New Medical Consultation
          </button>
        )}
      </div>

      {activeTab === 'new' ? (
        <div style={{ width: '100%' }}>
          <ConsultationModal
            initialData={modal}
            onClose={() => setActiveTab('list')}
            onSaved={handleSaved}
            inline
          />
        </div>
      ) : (
        <>
          {/* Search + Filter Toolbar */}
          <div className="page-toolbar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div className="global-search-container" style={{ flex: 1, minWidth: '280px', maxWidth: '400px' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <input
                className="global-search-input"
                placeholder="Search by patient name, student ID, or service..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{
                    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
                    fontSize: '0.9rem', padding: '2px 6px',
                  }}
                  title="Clear search"
                >
                  âœ•
                </button>
              )}
            </div>

            {/* Filter popover button */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`filter-btn-outline ${activeFilterCount > 0 ? 'active' : ''}`}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.45rem',
                  padding: '0.55rem 1rem', borderRadius: 'var(--radius-full)',
                  border: activeFilterCount > 0 ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: activeFilterCount > 0 ? 'var(--accent-light)' : '#FFFFFF',
                  color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text)',
                  fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer',
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
                onClick={resetFilters}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="table-loading"><span className="loader-ring" /></div>
          ) : filteredRecords.length === 0 ? (
            <div className="empty-state" style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '3rem 1.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                {search || activeFilterCount > 0
                  ? 'No medical consultations match your search or filter criteria.'
                  : 'No medical consultations recorded yet.'}
              </p>
              {(search || activeFilterCount > 0) ? (
                <button type="button" className="btn-secondary" onClick={resetFilters}>
                  Clear Filters
                </button>
              ) : isNurse ? (
                <button className="btn-primary" onClick={() => setActiveTab('new')}>
                  Start First Consultation
                </button>
              ) : null}
            </div>
          ) : (
            <div className="data-table-wrap" style={{ overflowX: 'auto', width: '100%', boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-md)' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Date</th>
                    <th>Patient</th>
                    <th>Service</th>
                    <th style={{ width: '130px' }}>Status</th>
                    <th>Attending Nurse</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map(r => {
                    const patientUser = r.patient?.user || {}
                    const serviceName = r.appointment?.service?.name || r.service_name || 'â€”'
                    const status = r.status || 'completed'
                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {formatDate(r.visit_date)}
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
                            <Avatar src={r.created_by?.avatar_url} name={r.created_by?.name} size={24} />
                            {r.created_by?.name || 'Clinic Staff'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                            onClick={() => setViewRecord(r)}
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
          )}
        </>
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
        <ViewConsultationModal
          record={viewRecord}
          onClose={() => setViewRecord(null)}
          onEdit={isNurse ? (rec) => {
            setModal(rec)
            setActiveTab('new')
          } : null}
        />
      )}
    </DashboardLayout>
  )
}
