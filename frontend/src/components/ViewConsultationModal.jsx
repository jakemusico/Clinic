import { useEffect, useState } from 'react'
import { recordsApi } from '../api/records'
import PrintableRecord from './PrintableRecord'
import { toast } from 'react-hot-toast'

/* ── Helpers ────────────────────────────────────────────────── */
const fmtDate = (dateStr) => {
  if (!dateStr) return '—'
  const clean = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
  const d = new Date(clean + 'T00:00:00')
  if (isNaN(d.getTime())) return String(dateStr)
  return d.toLocaleDateString('en-PH', { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })
}

const calcBMI = (weight, height) => {
  const w = parseFloat(weight)
  const h = parseFloat(height) / 100
  if (!w || !h || h === 0) return null
  return (w / (h * h)).toFixed(1)
}

const bmiCategory = (bmi) => {
  const v = parseFloat(bmi)
  if (!v) return ''
  if (v < 18.5) return 'Underweight'
  if (v < 25) return 'Normal weight'
  if (v < 30) return 'Overweight'
  return 'Obese'
}

function DetailRow({ label, value, accent = false }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>{label}</div>
      <div style={{
        fontSize: '0.875rem', fontWeight: accent ? 600 : 500,
        color: accent ? 'var(--accent)' : 'var(--text)',
        borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px'
      }}>
        {value || '—'}
      </div>
    </div>
  )
}

function TextBlock({ label, value }) {
  const empty = !value || String(value).trim() === ''
  return (
    <div style={{ marginBottom: '0.75rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '4px' }}>{label}</div>
      <div style={{
        fontSize: '0.875rem', color: empty ? 'var(--text-muted)' : 'var(--text)',
        fontStyle: empty ? 'italic' : 'normal',
        background: 'var(--bg-sub)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.75rem',
        minHeight: '36px', whiteSpace: 'pre-wrap', wordBreak: 'break-word'
      }}>
        {empty ? 'None recorded' : value}
      </div>
    </div>
  )
}

function SectionHeading({ children }) {
  return (
    <h3 style={{
      fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
      color: 'var(--accent)', borderBottom: '1px solid var(--accent-light)',
      paddingBottom: '0.35rem', marginBottom: '0.75rem', marginTop: '1.25rem'
    }}>
      {children}
    </h3>
  )
}

function RecordDetail({ record }) {
  const pu = record.patient?.user || {}
  const vitals = record.vitals || {}
  const serviceName = record.appointment?.service?.name || record.service_name || 'Medical Consultation'
  const bmiVal = vitals.bmi || calcBMI(vitals.weight, vitals.height)
  const bmiDisplay = bmiVal ? `${bmiVal} kg/m² (${bmiCategory(bmiVal)})` : null

  return (
    <div>
      {/* Patient Information */}
      <SectionHeading>Patient Information</SectionHeading>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem 1.25rem' }}>
        <DetailRow label="Full Name" value={pu.name} accent />
        <DetailRow label="Student / Employee ID" value={pu.student_id} />
        <DetailRow label="Email" value={pu.email} />
        <DetailRow label="Department / Course" value={pu.department} />
      </div>

      {/* Consultation Overview */}
      <SectionHeading>Consultation Overview</SectionHeading>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem 1.25rem' }}>
        <DetailRow label="Date" value={fmtDate(record.visit_date)} />
        <DetailRow label="Clinic Service" value={serviceName} />
        <DetailRow label="Attending Staff" value={record.created_by?.name || record.createdBy?.name} />
        <DetailRow label="Status" value={
          <span className="status-badge completed" style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>
            {record.status || 'completed'}
          </span>
        } />
      </div>

      {/* Vital Signs */}
      {Object.keys(vitals).length > 0 && (
        <>
          <SectionHeading>Vital Signs</SectionHeading>
          <div style={{
            background: 'var(--bg-sub)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem'
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem 1rem' }}>
              <DetailRow label="Blood Pressure" value={vitals.blood_pressure || vitals.bp} />
              <DetailRow label="Temperature" value={vitals.temperature ? `${vitals.temperature} °C` : null} />
              <DetailRow label="Pulse Rate" value={vitals.pulse_rate ? `${vitals.pulse_rate} bpm` : null} />
              <DetailRow label="Weight" value={vitals.weight ? `${vitals.weight} kg` : null} />
              <DetailRow label="Height" value={vitals.height ? `${vitals.height} cm` : null} />
              <DetailRow label="BMI" value={bmiDisplay} accent />
            </div>
            {vitals.respiratory_rate && (
              <div style={{ marginTop: '0.5rem' }}>
                <DetailRow label="Respiratory Rate" value={`${vitals.respiratory_rate} breaths/min`} />
              </div>
            )}
          </div>
        </>
      )}

      {/* Clinical Findings */}
      <SectionHeading>Clinical Findings</SectionHeading>
      <TextBlock label="Reason for Visit / Chief Complaint" value={record.chief_complaint} />
      {record.symptoms && <TextBlock label="Symptoms" value={record.symptoms} />}
      {record.assessment && <TextBlock label="Assessment / Clinical Findings" value={record.assessment} />}
      <TextBlock label="Diagnosis" value={record.diagnosis || record.assessment} />
      <TextBlock label="Treatment & Recommendations" value={record.treatment || record.recommendation} />
      {record.prescription && <TextBlock label="Prescription / Medicines" value={record.prescription} />}
      {(record.notes || record.remarks) && <TextBlock label="Additional Notes" value={record.notes || record.remarks} />}
    </div>
  )
}

/**
 * ViewConsultationModal
 *
 * Props:
 *   record   – full clinic record object (must have patient.user, appointment.service, createdBy)
 *   recordId – alternative to record: fetch by ID from /clinic/records/{id}
 *   onClose  – callback to close the modal
 *   onEdit   – optional callback to open the edit form
 */
export function ViewConsultationModal({ record: recordProp, recordId, onClose, onEdit }) {
  const [record, setRecord] = useState(recordProp || null)
  const [loading, setLoading] = useState(!recordProp && !!recordId)
  const [error, setError] = useState(null)

  // If only recordId provided or recordProp lacks nested relations, fetch full record
  useEffect(() => {
    const idToFetch = recordId || (recordProp?.id && (!recordProp.patient?.user) ? recordProp.id : null)
    if (!idToFetch) {
      setRecord(recordProp)
      return
    }
    setLoading(true)
    recordsApi.get(idToFetch)
      .then(({ data }) => {
        setRecord(data.record || data)
        setLoading(false)
      })
      .catch((err) => {
        console.error('Failed to load record:', err)
        if (err?.response?.status === 403) {
          setError('Medical access restricted. Administrators require explicit medical access permissions to view confidential consultation clinical notes.')
        } else {
          toast.error('Failed to load consultation details.')
          setError('Could not load consultation details.')
        }
        setLoading(false)
      })
  }, [recordId, recordProp])

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '700px', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 700 }}>Consultation Details</h2>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            {record && (
              <PrintableRecord record={record} buttonLabel="Print" buttonClass="btn-outline" />
            )}
            {record && onEdit && (
              <button className="btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }} onClick={() => onEdit(record)}>
                Edit
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '1.25rem', overflowY: 'auto', flexGrow: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem', color: 'var(--text-muted)' }}>
              <span className="loader-ring" />
              <span>Loading consultation details…</span>
            </div>
          ) : error ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--red)' }}>
              <svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" style={{ margin: '0 auto 0.5rem', display: 'block' }}>
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p>{error}</p>
            </div>
          ) : record ? (
            <RecordDetail record={record} />
          ) : null}
        </div>
      </div>
    </div>
  )
}
