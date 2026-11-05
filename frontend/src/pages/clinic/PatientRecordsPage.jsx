import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import PrintableRecord from '../../components/PrintableRecord'
import Pagination from '../../components/Pagination'
import { recordsApi } from '../../api/records'
import { EMPTY, serviceLabel } from '../../utils/emptyValue'
import { formatDateLong as formatDate, toDateKey, todayISO } from '../../utils/dateUtils'
import { useDebouncedValue } from '../../hooks/useDebouncedValue'

const byNewestVisit = (a, b) => (toDateKey(b.visit_date) || '').localeCompare(toDateKey(a.visit_date) || '')

const calcBMI = (weight, height) => {
  const w = parseFloat(weight)
  const h = parseFloat(height) / 100
  if (!w || !h || h === 0) return null
  return (w / (h * h)).toFixed(1)
}

const getBMICategory = (bmi) => {
  const v = parseFloat(bmi)
  if (!v) return ''
  if (v < 18.5) return 'Underweight'
  if (v < 25)   return 'Normal weight'
  if (v < 30)   return 'Overweight'
  return 'Obese'
}

function ViewPatientProfileModal({ patient, onClose }) {
  const user = patient.user || patient
  const sortedConsultations = [...(patient.consultations || [])].sort(byNewestVisit)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '720px' }}>
        <div className="modal-header">
          <h2>Patient Medical Profile</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body read-only-record">
          {/* Patient Basic Info */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Patient Information</h3>
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
              Consultation History ({sortedConsultations.length})
            </h3>

            {sortedConsultations.length === 0 ? (
              <div className="empty-state" style={{ padding: '1.5rem 1rem' }}>
                <p>No past medical consultations recorded for this patient.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {sortedConsultations.map(c => {
                  const v = c.vitals || {}
                  const bmiVal = v.bmi || calcBMI(v.weight, v.height)
                  const cat = bmiVal ? getBMICategory(bmiVal) : ''
                  const bmiStr = bmiVal ? `${bmiVal} kg/m² ${cat ? `(${cat})` : ''}` : EMPTY

                  return (
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
                            {serviceLabel(c)}
                          </span>
                          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            • {formatDate(c.visit_date)}
                          </span>
                        </div>
                        <PrintableRecord
                          record={c}
                          patientUser={user}
                          buttonLabel="Print Record"
                        />
                      </div>

                      {(v.weight || v.height || v.bp || v.blood_pressure) && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-sub)', background: 'var(--bg-crust)', padding: '0.4rem 0.65rem', borderRadius: 'var(--radius-sm)', marginBottom: '0.5rem', border: '1px solid var(--border)' }}>
                          <strong>Vitals & BMI:</strong> BP: {v.blood_pressure || v.bp || EMPTY} | Temp: {v.temperature ? `${v.temperature}°C` : EMPTY} | Weight: {v.weight ? `${v.weight}kg` : EMPTY} | Height: {v.height ? `${v.height}cm` : EMPTY} | <strong style={{ color: 'var(--accent)' }}>BMI:</strong> {bmiStr}
                        </div>
                      )}

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1rem', fontSize: '0.82rem', marginBottom: '0.5rem' }}>
                        <div><strong>Chief Complaint:</strong> {c.chief_complaint || EMPTY}</div>
                        <div><strong>Diagnosis:</strong> <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{c.diagnosis || c.assessment || EMPTY}</span></div>
                        <div><strong>Treatment:</strong> {c.treatment || c.recommendation || EMPTY}</div>
                        <div><strong>Attending Staff:</strong> {c.created_by?.name || 'Clinic Staff'}</div>
                      </div>

                      {c.prescription && (
                        <div style={{ fontSize: '0.8rem', background: '#F8FAFC', padding: '0.45rem 0.65rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginTop: '0.35rem' }}>
                          <strong>Prescription:</strong> {c.prescription}
                        </div>
                      )}
                    </div>
                  )
                })}
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

export default function PatientRecordsPage() {
  const [patients, setPatients]                 = useState([])
  const [allRecords, setAllRecords]             = useState([])
  const [loading, setLoading]                   = useState(true)
  const [search, setSearch]                     = useState('')
  const debouncedSearch = useDebouncedValue(search)
  const [page, setPage]                         = useState(1)
  const [pageSize, setPageSize]                 = useState(10)
  const [selectedPatient, setSelectedPatient]   = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [recordsRes, patientsRes] = await Promise.all([
        recordsApi.list(),
        recordsApi.patients(),
      ])

      const recordsList = recordsRes.data.records || []
      const patientsList = patientsRes.data.patients || []

      setAllRecords(recordsList)

      const patientMap = new Map()

      patientsList.forEach(p => {
        patientMap.set(p.id, {
          id: p.id,
          user: p.user || p,
          consultations: []
        })
      })

      recordsList.forEach(r => {
        const pId = r.patient_id || r.patient?.id
        if (pId && patientMap.has(pId)) {
          patientMap.get(pId).consultations.push(r)
        } else if (r.patient) {
          const existing = patientMap.get(r.patient.id)
          if (existing) {
            existing.consultations.push(r)
          } else {
            patientMap.set(r.patient.id, {
              id: r.patient.id,
              user: r.patient.user || r.patient,
              consultations: [r]
            })
          }
        }
      })

      setPatients(Array.from(patientMap.values()))
    } catch {
      toast.error('Failed to load patient directory.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const filteredPatients = patients.filter(p => {
    const u = p.user || {}
    const nameStr = (u.name || '').toLowerCase()
    const idStr = (u.student_id || '').toLowerCase()
    const emailStr = (u.email || '').toLowerCase()
    const deptStr = (u.department || '').toLowerCase()
    const q = debouncedSearch.toLowerCase()
    return nameStr.includes(q) || idStr.includes(q) || emailStr.includes(q) || deptStr.includes(q)
  })

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize))
  const paginatedPatients = filteredPatients.slice((page - 1) * pageSize, page * pageSize)

  const todayStr = todayISO()
  const todayConsultationsCount = allRecords.filter(r => {
    return toDateKey(r.visit_date) === todayStr
  }).length

  const stats = [
    { value: allRecords.length, label: 'Total Records' },
    { value: todayConsultationsCount, label: "Today's Consultations" },
  ]

  return (
    <DashboardLayout
      title="Patient Medical Directory"
      subtitle="View student and staff health profiles, consultation counts, and visit histories."
      stats={stats}
    >
      <div className="page-toolbar" style={{ marginBottom: '1.25rem' }}>
        <input
          className="search-input"
          placeholder="Search by patient name, student/staff ID, department, or email..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', maxWidth: '480px' }}
        />
      </div>

      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : filteredPatients.length === 0 ? (
        <div className="empty-state">
          <p>{search ? 'No patient profiles match your search criteria.' : 'No registered patients found.'}</p>
        </div>
      ) : (
        <>
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
                  lastVisit = formatDate(sorted[0].visit_date)
                }

                return (
                  <tr key={p.id}>
                    <td className="td-name">
                      <div>{user.name || 'Unknown Patient'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{user.email || ''}</div>
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
        </>
      )}

      {selectedPatient && (
        <ViewPatientProfileModal
          patient={selectedPatient}
          onClose={() => setSelectedPatient(null)}
        />
      )}
    </DashboardLayout>
  )
}
