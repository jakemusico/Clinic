import { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import PrintableRecord from '../../components/PrintableRecord'
import Pagination from '../../components/Pagination'
import SearchToolbar from '../../components/SearchToolbar'
import Avatar from '../../components/Avatar'
import Dropdown from '../../components/Dropdown'
import { recordsApi } from '../../api/records'
import { dentalApi } from '../../api/dental'
import { toast } from 'react-hot-toast'
import { EMPTY, serviceLabel } from '../../utils/emptyValue'
import { formatDateLong as formatDate, toDateKey } from '../../utils/dateUtils'
import { buildRoleOptions, filterPatientsByRole } from '../../utils/roleHelper'

const byNewestVisit = (a, b) => (toDateKey(b.consultation_date) || '').localeCompare(toDateKey(a.consultation_date) || '')

function ViewPatientProfileModal({ patient, onClose }) {
  const navigate = useNavigate()
  const user = patient.user || patient
  const sortedConsultations = [...(patient.consultations || [])].sort(byNewestVisit)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '720px' }}>
        <div className="modal-header">
          <h2>Patient Dental Profile</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body read-only-record">
          {/* Patient Basic Info */}
          <div className="detail-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ color: 'var(--accent)', fontWeight: 700, margin: 0 }}>Patient Information</h3>
              <button
                onClick={() => {
                  onClose()
                  navigate('/dental/chart', { state: { patientId: patient.id } })
                }}
                className="btn-secondary"
              >
                Open Dental Chart
              </button>
            </div>
            <div className="detail-grid">
              <div><strong>Name:</strong> {user.name || 'N/A'}</div>
              <div><strong>Student / Employee ID:</strong> {user.student_id || 'N/A'}</div>
              <div><strong>Email:</strong> {user.email || 'N/A'}</div>
              <div><strong>Department:</strong> {user.department || 'N/A'}</div>
              <div><strong>Contact Number:</strong> {user.contact_no || 'N/A'}</div>
              <div><strong>Total Consultations:</strong> <span className="status-badge completed">{sortedConsultations.length}</span></div>
            </div>
          </div>

          {/* Consultation History */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>
              Dental Consultation History ({sortedConsultations.length})
            </h3>

            {sortedConsultations.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                <p>No past dental consultations recorded for this patient.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {sortedConsultations.map(c => (
                  <div
                    key={c.id}
                    style={{
                      padding: '1rem',
                      borderRadius: 'var(--radius-sm)',
                      background: '#FFFFFF',
                      border: '1px solid var(--border)',
                      boxShadow: 'var(--shadow-xs)'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                      <div>
                        <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--accent)', marginRight: '0.5rem' }}>
                          {c.service_name || 'Dental Service'}
                        </span>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          • {formatDate(c.consultation_date)}
                        </span>
                      </div>
                      <PrintableRecord
                        record={c}
                        isDental={true}
                        patientUser={user}
                        buttonLabel="Print Record"
                      />
                    </div>

                    {c.affected_teeth && c.affected_teeth.length > 0 && (
                      <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                        <strong>Affected Teeth:</strong>{' '}
                        <span className="status-badge pending" style={{ fontSize: '0.68rem' }}>
                          #{c.affected_teeth.join(', #')}
                        </span>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                      <div><strong>Reason for Visit:</strong> {c.reason_for_visit || EMPTY}</div>
                      <div><strong>Diagnosis:</strong> <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.diagnosis || EMPTY}</span></div>
                      <div><strong>Treatment:</strong> {c.treatment_performed || EMPTY}</div>
                      <div><strong>Attending Dentist:</strong> {c.dentist?.name || 'Dental Staff'}</div>
                    </div>

                    {c.recommendations && (
                      <div style={{ fontSize: '0.8rem', background: '#F8FAFC', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginTop: '0.35rem' }}>
                        <strong>Recommendations:</strong> {c.recommendations}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button className="btn-primary" onClick={onClose}>Close Profile</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DentalPatientRecordsPage() {
  const [loading, setLoading]       = useState(true)
  const [patients, setPatients]     = useState([])
  const [allConsultations, setAllConsultations] = useState([])
  const [search, setSearch]         = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const filterRef = useRef(null)
  const [page, setPage]             = useState(1)
  const [pageSize, setPageSize]     = useState(10)
  const [selectedPatient, setSelectedPatient] = useState(null)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [pRes, cRes] = await Promise.all([
        recordsApi.patients(),
        dentalApi.listConsultations(),
      ])

      const patientsList = pRes.data.patients || []
      const consultationsList = cRes.data.consultations || []

      setAllConsultations(consultationsList)

      // Build patient map with consultation counts
      const patientMap = new Map()

      patientsList.forEach(p => {
        patientMap.set(p.id, {
          id: p.id,
          user: p.user || p,
          consultations: []
        })
      })

      consultationsList.forEach(c => {
        const pId = c.patient_id || c.patient?.id
        if (pId && patientMap.has(pId)) {
          patientMap.get(pId).consultations.push(c)
        } else if (c.patient) {
          const existing = patientMap.get(c.patient.id)
          if (existing) {
            existing.consultations.push(c)
          } else {
            patientMap.set(c.patient.id, {
              id: c.patient.id,
              user: c.patient.user || c.patient,
              consultations: [c]
            })
          }
        }
      })

      setPatients(Array.from(patientMap.values()))
    } catch {
      toast.error('Failed to load dental patient directory.')
    } finally {
      setLoading(false)
    }
  }

  const roleOptions = useMemo(() => {
    return [{ value: 'all', label: 'All Roles' }, ...buildRoleOptions(patients)]
  }, [patients])

  const activeFilterCount = roleFilter !== 'all' ? 1 : 0

  const resetFilters = () => {
    setRoleFilter('all')
  }

  const filteredPatients = useMemo(() => {
    let results = patients.filter(p => {
      const u = p.user || {}
      const nameStr = (u.name || '').toLowerCase()
      const idStr = (u.student_id || '').toLowerCase()
      const emailStr = (u.email || '').toLowerCase()
      const deptStr = (u.department || '').toLowerCase()
      const q = search.toLowerCase()
      return nameStr.includes(q) || idStr.includes(q) || emailStr.includes(q) || deptStr.includes(q)
    })

    // Apply role filter
    results = filterPatientsByRole(results, roleFilter)

    return results
  }, [patients, search, roleFilter])

  useEffect(() => {
    setPage(1)
  }, [search, roleFilter])

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize))
  const paginatedPatients = filteredPatients.slice((page - 1) * pageSize, page * pageSize)

  const stats = [
    { value: patients.length, label: 'Registered Patients' },
    { value: allConsultations.length, label: 'Total Records' },
  ]

  return (
    <DashboardLayout
      title="Dental Patient Directory"
      subtitle="View student and staff dental profiles, consultation history, and dental charts."
      stats={stats}
    >
      <div className="page-fixed-list fixed-list-layout">
        {/* Fixed Top Section */}
        <div className="fixed-list-top">
          <SearchToolbar
            value={search}
            onChange={setSearch}
            placeholder="Search by patient name, student/staff ID, department, or email..."
            filterContent={(
              <div className="search-toolbar-filter-section">
                <label className="search-toolbar-filter-label">Patient Role</label>
                <Dropdown
                  variant="filter"
                  value={roleFilter}
                  onChange={setRoleFilter}
                  options={roleOptions}
                />
              </div>
            )}
            activeFilterCount={activeFilterCount}
            filterOpen={filterPopoverOpen}
            onFilterToggle={() => setFilterPopoverOpen(!filterPopoverOpen)}
            filterRef={filterRef}
          />
          {activeFilterCount > 0 && (
            <button
              type="button"
              className="search-toolbar-filter-reset"
              style={{
                marginTop: '0.75rem',
                padding: '0.5rem',
                width: '100%',
              }}
              onClick={resetFilters}
            >
              Reset filters
            </button>
          )}
        </div>

        {loading ? (
          <div className="table-loading"><span className="loader-ring" /></div>
        ) : filteredPatients.length === 0 ? (
          <div className="empty-state">
            <p>{search || activeFilterCount > 0 ? 'No patients match your filters.' : 'No registered patients found.'}</p>
            {(search || activeFilterCount > 0) && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setSearch('')
                  resetFilters()
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="fixed-list-body">
            {/* Scrollable Table */}
            <div className="fixed-list-scroll">
              <div className="data-table-wrap">
                <table className="data-table">
              <thead>
                <tr>
                  <th>Patient Name</th>
                  <th>Student / Staff ID</th>
                  <th>Department</th>
                  <th>Total Consultations</th>
                  <th>Last Visit Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPatients.map(p => {
                  const user = p.user || {}
                  const total = p.consultations.length

                  let lastVisit = EMPTY
                  if (p.consultations.length > 0) {
                    const sorted = [...p.consultations].sort(byNewestVisit)
                    lastVisit = formatDate(sorted[0].consultation_date)
                  }

                  return (
                    <tr key={p.id}>
                      <td className="td-name">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <Avatar src={user.avatar_url} name={user.name} size={30} />
                          <div>
                            <div>{user.name || 'Unknown Patient'}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email || ''}</div>
                          </div>
                        </div>
                      </td>
                      <td>{user.student_id || 'N/A'}</td>
                      <td>{user.department || 'N/A'}</td>
                      <td>
                        <span className={`status-badge ${total > 0 ? 'completed' : 'pending'}`}>
                          {total} {total === 1 ? 'record' : 'records'}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{lastVisit}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn-secondary"
                          onClick={() => setSelectedPatient(p)}
                        >
                          View Profile
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
              </div>
            </div>

            {/* Pinned Pagination */}
            <div className="fixed-list-bottom">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredPatients.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize)
                  setPage(1)
                }}
              />
            </div>
          </div>
        )}
      </div>

      {selectedPatient && (
        <ViewPatientProfileModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </DashboardLayout>
  )
}
