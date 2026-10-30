import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import PrintableRecord from '../../components/PrintableRecord'
import Pagination from '../../components/Pagination'
import { recordsApi } from '../../api/records'
import { dentalApi } from '../../api/dental'

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  records:     'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  dentalChart: 'M12 2a4 4 0 00-4 4v2a2 2 0 002 2h4a2 2 0 002-2V6a4 4 0 00-4-4zM6 14a2 2 0 012-2h8a2 2 0 012 2v4a4 4 0 01-4 4h-4a4 4 0 01-4-4v-4z',
}

const formatDate = (dateStr) => {
  if (!dateStr) return '—'
  const cleanStr = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : String(dateStr)
  const d = new Date(cleanStr + 'T00:00:00')
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
}

function ViewMedicalRecordModal({ record, onClose }) {
  const vitals = record.vitals || {}
  const patientUser = record.patient?.user || {}
  const status = record.status || 'completed'

  const calcBMI = (w, h) => {
    const floatW = parseFloat(w)
    const floatH = parseFloat(h) / 100
    if (!floatW || !floatH || floatH === 0) return null
    return (floatW / (floatH * floatH)).toFixed(1)
  }

  const getBMICategory = (bmi) => {
    const v = parseFloat(bmi)
    if (!v) return ''
    if (v < 18.5) return 'Underweight'
    if (v < 25)   return 'Normal weight'
    if (v < 30)   return 'Overweight'
    return 'Obese'
  }

  const bmiVal = vitals.bmi || calcBMI(vitals.weight, vitals.height)
  const bmiCat = bmiVal ? getBMICategory(bmiVal) : ''
  const bmiDisplay = bmiVal ? `${bmiVal} kg/m² ${bmiCat ? `(${bmiCat})` : ''}` : '—'

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h2>Medical Consultation Details</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body read-only-record">
          {/* Patient Information */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Patient Information</h3>
            <div className="detail-grid">
              <div><strong>Name:</strong> {patientUser.name || 'N/A'}</div>
              <div><strong>Student / Employee ID:</strong> {patientUser.student_id || 'N/A'}</div>
              <div><strong>Email:</strong> {patientUser.email || 'N/A'}</div>
              <div><strong>Department:</strong> {patientUser.department || 'N/A'}</div>
            </div>
          </div>

          {/* Consultation Overview */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Consultation Overview</h3>
            <div className="detail-grid">
              <div><strong>Consultation Date:</strong> {formatDate(record.visit_date)}</div>
              <div><strong>Clinic Service:</strong> {record.appointment?.service?.name || record.service_name || 'General Consultation'}</div>
              <div><strong>Status:</strong> <span className={`status-badge ${status}`} style={{ textTransform: 'capitalize' }}>{status}</span></div>
              <div><strong>Attending Staff:</strong> {record.created_by?.name || 'Clinic Staff'}</div>
            </div>
          </div>

          {/* Vital Signs */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Vital Signs</h3>
            <div className="detail-grid" style={{ background: 'var(--bg-crust)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div><strong>Blood Pressure:</strong> {vitals.blood_pressure || vitals.bp || '—'}</div>
              <div><strong>Temperature:</strong> {vitals.temperature ? `${vitals.temperature} °C` : '—'}</div>
              <div><strong>Pulse Rate:</strong> {vitals.pulse_rate ? `${vitals.pulse_rate} bpm` : '—'}</div>
              <div><strong>Weight:</strong> {vitals.weight ? `${vitals.weight} kg` : '—'}</div>
              <div><strong>Height:</strong> {vitals.height ? `${vitals.height} cm` : '—'}</div>
              <div><strong>BMI:</strong> {bmiDisplay}</div>
            </div>
          </div>

          {/* Clinical Examination & Findings */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Clinical Examination & Findings</h3>
            
            <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
              <strong>Reason for Visit / Chief Complaint:</strong>
              <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {record.chief_complaint || '—'}
              </div>
            </div>

            {record.symptoms && (
              <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
                <strong>Symptoms:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {record.symptoms}
                </div>
              </div>
            )}

            {record.assessment && (
              <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
                <strong>Assessment / Clinical Findings:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {record.assessment}
                </div>
              </div>
            )}

            <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
              <strong>Diagnosis:</strong>
              <div className="detail-text highlighted" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)' }}>
                {record.diagnosis || 'General Check-up'}
              </div>
            </div>

            <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
              <strong>Treatment & Recommendations:</strong>
              <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {record.treatment || record.recommendation || '—'}
              </div>
            </div>

            {record.prescription && (
              <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
                <strong>Prescription / Medicines:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {record.prescription}
                </div>
              </div>
            )}

            {(record.notes || record.remarks) && (
              <div className="detail-block">
                <strong>Additional Notes:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {record.notes || record.remarks}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <PrintableRecord
              record={record}
              patientUser={patientUser}
              buttonLabel="Print Record"
            />
            <button className="btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ViewDentalRecordModal({ record, onClose }) {
  const patientUser = record.patient?.user || {}
  const status = record.status || 'completed'

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h2>Dental Consultation Details</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body read-only-record">
          {/* Patient Information */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Patient Information</h3>
            <div className="detail-grid">
              <div><strong>Name:</strong> {patientUser.name || 'N/A'}</div>
              <div><strong>Student / Employee ID:</strong> {patientUser.student_id || 'N/A'}</div>
              <div><strong>Email:</strong> {patientUser.email || 'N/A'}</div>
              <div><strong>Department:</strong> {patientUser.department || 'N/A'}</div>
            </div>
          </div>

          {/* Consultation Overview */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Consultation Overview</h3>
            <div className="detail-grid">
              <div><strong>Consultation Date:</strong> {formatDate(record.consultation_date)}</div>
              <div><strong>Dental Service:</strong> {record.appointment?.service?.name || record.diagnosis || 'Dental Consultation'}</div>
              <div><strong>Status:</strong> <span className={`status-badge ${status}`} style={{ textTransform: 'capitalize' }}>{status}</span></div>
              <div><strong>Attending Dentist:</strong> {record.dentist?.name || 'Dentist'}</div>
            </div>
          </div>

          {/* Affected Teeth */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Affected Teeth (FDI Notation)</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', background: '#F8FAFC', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              {record.affected_teeth && record.affected_teeth.length > 0 ? (
                record.affected_teeth.map(t => (
                  <span key={t} className="status-badge completed" style={{ fontSize: '0.82rem', padding: '0.25rem 0.6rem' }}>
                    Tooth #{t}
                  </span>
                ))
              ) : (
                <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>No specific teeth recorded</span>
              )}
            </div>
          </div>

          {/* Clinical Findings & Treatment */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Clinical Findings & Treatment</h3>

            <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
              <strong>Reason for Visit / Chief Complaint:</strong>
              <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {record.reason_for_visit || '—'}
              </div>
            </div>

            {record.dental_findings && (
              <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
                <strong>Dental Findings:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {record.dental_findings}
                </div>
              </div>
            )}

            <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
              <strong>Diagnosis:</strong>
              <div className="detail-text highlighted" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', fontWeight: 600, color: 'var(--accent)', background: 'var(--accent-light)', borderRadius: 'var(--radius-sm)' }}>
                {record.diagnosis || 'Dental Examination'}
              </div>
            </div>

            <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
              <strong>Treatment Performed:</strong>
              <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {record.treatment_performed || '—'}
              </div>
            </div>

            {record.recommendations && (
              <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
                <strong>Recommendations / Instructions:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {record.recommendations}
                </div>
              </div>
            )}

            {record.notes && (
              <div className="detail-block">
                <strong>Patient Notes:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {record.notes}
                </div>
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <PrintableRecord
              record={record}
              isDental={true}
              patientUser={patientUser}
              buttonLabel="Print Record"
            />
            <button className="btn-primary" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function MyRecordsPage() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)
  const initTab = searchParams.get('tab') === 'dental' ? 'dental' : 'medical'

  const [activeTab, setActiveTab]       = useState(initTab)
  const [medicalRecords, setMedicalRecords] = useState([])
  const [dentalRecords, setDentalRecords]   = useState([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [viewMedicalRecord, setViewMedicalRecord] = useState(null)
  const [viewDentalRecord, setViewDentalRecord]   = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const [mRes, dRes] = await Promise.all([
        recordsApi.list(),
        dentalApi.listConsultations(),
      ])
      setMedicalRecords(mRes.data.records || [])
      setDentalRecords(dRes.data.consultations || [])
    } catch {
      toast.error('Failed to load health records.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filteredMedical = medicalRecords.filter(r =>
    (r.diagnosis || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.treatment || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.chief_complaint || '').toLowerCase().includes(search.toLowerCase())
  )

  const filteredDental = dentalRecords.filter(r =>
    (r.diagnosis || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.treatment_performed || '').toLowerCase().includes(search.toLowerCase()) ||
    (r.reason_for_visit || '').toLowerCase().includes(search.toLowerCase())
  )

  const [medPage, setMedPage] = useState(1)
  const [medPageSize, setMedPageSize] = useState(10)
  const [dentPage, setDentPage] = useState(1)
  const [dentPageSize, setDentPageSize] = useState(10)

  useEffect(() => {
    setMedPage(1)
    setDentPage(1)
  }, [search, activeTab])

  const medTotalPages = Math.max(1, Math.ceil(filteredMedical.length / medPageSize))
  const paginatedMedical = filteredMedical.slice((medPage - 1) * medPageSize, medPage * medPageSize)

  const dentTotalPages = Math.max(1, Math.ceil(filteredDental.length / dentPageSize))
  const paginatedDental = filteredDental.slice((dentPage - 1) * dentPageSize, dentPage * dentPageSize)

  const stats = [
    { value: medicalRecords.length, label: 'Medical Consultations', icon: 'consultations' },
    { value: dentalRecords.length,  label: 'Dental Consultations',  icon: 'dentalChart' },
  ]

  return (
    <DashboardLayout title="My Health Records" subtitle="View your medical and dental consultation history." stats={stats}>
      
      {/* Category Tabs & Search Bar Container Card */}
      <div className="data-table-wrap" style={{ padding: '1rem 1.25rem', marginBottom: '1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          {/* Segmented Control Filter Tabs */}
          <div className="tab-bar" style={{ margin: 0 }}>
            <button
              className={`tab-btn ${activeTab === 'medical' ? 'active' : ''}`}
              onClick={() => setActiveTab('medical')}
            >
              <Icon d={ICONS.records} size={16} />
              Medical Records ({medicalRecords.length})
            </button>
            <button
              className={`tab-btn ${activeTab === 'dental' ? 'active' : ''}`}
              onClick={() => setActiveTab('dental')}
            >
              <Icon d={ICONS.dentalChart} size={16} />
              Dental Records ({dentalRecords.length})
            </button>
          </div>

          {/* Search Input */}
          <div style={{ flex: 1, maxWidth: '380px', minWidth: '240px' }}>
            <input
              type="text"
              className="search-input"
              placeholder="Search diagnosis, treatment, reason for visit..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : activeTab === 'medical' ? (
        filteredMedical.length === 0 ? (
          <div className="empty-state">
            <p>{search ? 'No medical records match your search.' : 'You do not have any completed medical consultation records yet.'}</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Consultation Date</th>
                  <th>Clinic Service</th>
                  <th>Diagnosis / Findings</th>
                  <th>Attending Staff</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedMedical.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                      {formatDate(r.visit_date)}
                    </td>
                    <td>{r.appointment?.service?.name || r.service_name || 'Medical Consultation'}</td>
                    <td className="td-name">{r.diagnosis || r.assessment || 'General Check-up'}</td>
                    <td>{r.created_by?.name || 'Nurse'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-secondary" onClick={() => setViewMedicalRecord(r)}>
                        View Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={medPage}
              totalPages={medTotalPages}
              totalItems={filteredMedical.length}
              pageSize={medPageSize}
              onPageChange={setMedPage}
              onPageSizeChange={(newSize) => {
                setMedPageSize(newSize)
                setMedPage(1)
              }}
            />
          </div>
        )
      ) : (
        /* Dental Records Tab */
        filteredDental.length === 0 ? (
          <div className="empty-state">
            <p>{search ? 'No dental records match your search.' : 'You do not have any completed dental consultation records yet.'}</p>
          </div>
        ) : (
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Reason for Visit</th>
                  <th>Affected Teeth</th>
                  <th>Diagnosis</th>
                  <th>Treatment Performed</th>
                  <th>Dentist</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDental.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600, whiteSpace: 'nowrap', fontSize: '0.82rem' }}>
                      {formatDate(r.consultation_date)}
                    </td>
                    <td className="td-name">{r.reason_for_visit || 'Dental Checkup'}</td>
                    <td>
                      {r.affected_teeth && r.affected_teeth.length > 0 ? (
                        <span className="status-badge completed">#{r.affected_teeth.join(', #')}</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>None</span>
                      )}
                    </td>
                    <td style={{ fontWeight: 600 }}>{r.diagnosis || '—'}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>{r.treatment_performed || '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{r.dentist?.name || 'Dentist'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn-secondary" onClick={() => setViewDentalRecord(r)}>
                        View Record
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              currentPage={dentPage}
              totalPages={dentTotalPages}
              totalItems={filteredDental.length}
              pageSize={dentPageSize}
              onPageChange={setDentPage}
              onPageSizeChange={(newSize) => {
                setDentPageSize(newSize)
                setDentPage(1)
              }}
            />
          </div>
        )
      )}

      {viewMedicalRecord && (
        <ViewMedicalRecordModal
          record={viewMedicalRecord}
          onClose={() => setViewMedicalRecord(null)}
        />
      )}

      {viewDentalRecord && (
        <ViewDentalRecordModal
          record={viewDentalRecord}
          onClose={() => setViewDentalRecord(null)}
        />
      )}
    </DashboardLayout>
  )
}

