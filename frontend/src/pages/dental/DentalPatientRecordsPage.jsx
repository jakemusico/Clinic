import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import PrintableRecord from '../../components/PrintableRecord'
import Pagination from '../../components/Pagination'
import { recordsApi } from '../../api/records'
import { dentalApi } from '../../api/dental'
import { toast } from 'react-hot-toast'
import { EMPTY } from '../../utils/emptyValue'
import { formatDateLong as formatDate } from '../../utils/dateUtils'

export default function DentalPatientRecordsPage() {
  const navigate                    = useNavigate()
  const [loading, setLoading]       = useState(true)
  const [patients, setPatients]     = useState([])
  const [allConsultations, setAllConsultations] = useState([])
  const [search, setSearch]         = useState('')
  const [rosterPage, setRosterPage] = useState(1)
  const [rosterPageSize, setRosterPageSize] = useState(10)
  const [selectedPatient, setSelectedPatient] = useState(null)
  const [patientConsultations, setPatientConsultations] = useState([])

  const rosterTotalPages = Math.max(1, Math.ceil(patients.length / rosterPageSize))
  const paginatedPatients = patients.slice((rosterPage - 1) * rosterPageSize, rosterPage * rosterPageSize)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async (query = '') => {
    try {
      setLoading(true)
      const [pRes, cRes] = await Promise.all([
        recordsApi.patients({ search: query }),
        dentalApi.listConsultations(),
      ])
      const list = pRes.data.patients || []
      setPatients(list)
      setAllConsultations(cRes.data.consultations || [])

      if (list.length > 0 && !selectedPatient) {
        handleSelectPatient(list[0])
      }
    } catch {
      toast.error('Failed to load dental patient directory.')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    fetchData(search)
  }

  const handleSelectPatient = async (p) => {
    setSelectedPatient(p)
    try {
      const res = await dentalApi.listConsultations({ patient_id: p.id })
      setPatientConsultations(res.data.consultations || [])
    } catch {
      toast.error('Failed to load patient dental history.')
    }
  }

  const stats = [
    { value: patients.length, label: 'Registered Patients' },
    { value: allConsultations.length, label: 'Total Dental Records' },
  ]

  return (
    <DashboardLayout
      title="Dental Patient Directory"
      subtitle="View student and staff dental profiles, consultation history, and dental charts."
      stats={stats}
    >
      {/* Search Bar */}
      <div className="page-toolbar" style={{ marginBottom: '1.25rem' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', width: '100%', maxWidth: '500px' }}>
          <input
            type="text"
            className="search-input"
            placeholder="Search patient name, student ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: '1.25rem' }}>
        
        {/* Left: Patient Roster */}
        <div className="data-table-wrap">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
              Patient Roster ({patients.length})
            </span>
          </div>

          {loading ? (
            <div className="table-loading"><span className="loader-ring" /></div>
          ) : patients.length === 0 ? (
            <div className="empty-state">
              <p>No patients found.</p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {paginatedPatients.map((p) => {
                  const isSelected = selectedPatient?.id === p.id
                  return (
                    <div
                      key={p.id}
                      onClick={() => handleSelectPatient(p)}
                      style={{
                        padding: '0.85rem 1.25rem',
                        borderBottom: '1px solid var(--border)',
                        background: isSelected ? 'var(--sidebar-active)' : '#FFFFFF',
                        borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'background var(--transition)',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.875rem', color: isSelected ? 'var(--accent)' : 'var(--text)' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                          ID: {p.student_id || 'N/A'} • {p.department || 'FSUU'}
                        </div>
                      </div>
                      <span className="status-badge active" style={{ fontSize: '0.62rem' }}>
                        {p.role}
                      </span>
                    </div>
                  )
                })}
              </div>

              <Pagination
                currentPage={rosterPage}
                totalPages={rosterTotalPages}
                totalItems={patients.length}
                pageSize={rosterPageSize}
                onPageChange={setRosterPage}
                onPageSizeChange={(newSize) => {
                  setRosterPageSize(newSize)
                  setRosterPage(1)
                }}
              />
            </>
          )}
        </div>

        {/* Right: Selected Patient Details & Dental History */}
        <div className="data-table-wrap" style={{ padding: '1.25rem' }}>
          {!selectedPatient ? (
            <div className="empty-state">
              <p>Select a patient from the directory on the left to view their profile.</p>
            </div>
          ) : (
            <div>
              {/* Header Info */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', paddingBottom: '0.85rem', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)' }}>
                    {selectedPatient.name}
                  </h3>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
                    {selectedPatient.email}
                  </div>
                </div>

                <button
                  onClick={() => navigate('/dental/chart', { state: { patientId: selectedPatient.id } })}
                  className="btn-secondary"
                >
                  Open Dental Chart
                </button>
              </div>

              {/* Patient Bio Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', padding: '0.85rem 1rem', background: 'var(--bg-crust)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '1.5rem', fontSize: '0.82rem' }}>
                <div><strong>Student/Staff ID:</strong> {selectedPatient.student_id || 'N/A'}</div>
                <div><strong>Department:</strong> {selectedPatient.department || 'N/A'}</div>
                <div><strong>Contact Number:</strong> {selectedPatient.contact_no || 'N/A'}</div>
                <div><strong>System Role:</strong> {selectedPatient.role}</div>
              </div>

              {/* Consultation History Timeline */}
              <div className="quick-links-section-title" style={{ marginBottom: '1rem' }}>
                Dental Consultation History ({patientConsultations.length})
              </div>

              {patientConsultations.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <p>No past dental consultations recorded for this patient.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {patientConsultations.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: '1rem',
                        borderRadius: 'var(--radius-sm)',
                        background: '#FFFFFF',
                        border: '1px solid var(--border)',
                        boxShadow: 'var(--shadow-xs)',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--accent)' }}>
                          {c.diagnosis || EMPTY}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span className="status-badge completed">
                            {formatDate(c.consultation_date)}
                          </span>
                          <PrintableRecord
                            record={c}
                            isDental={true}
                            patientUser={selectedPatient}
                            buttonLabel="Print"
                          />
                        </div>
                      </div>

                      {c.affected_teeth && c.affected_teeth.length > 0 && (
                        <div style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>
                          <strong>Affected Teeth:</strong> <span className="status-badge pending" style={{ fontSize: '0.68rem' }}>#{c.affected_teeth.join(', #')}</span>
                        </div>
                      )}

                      {c.treatment_performed && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-sub)', marginBottom: '0.25rem' }}>
                          <strong>Treatment:</strong> {c.treatment_performed}
                        </div>
                      )}

                      {c.recommendations && (
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          <strong>Recommendations:</strong> {c.recommendations}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}
