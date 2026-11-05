import PrintableRecord from './PrintableRecord'
import { EMPTY, serviceLabel } from '../utils/emptyValue'
import { formatDateLong } from '../utils/dateUtils'

export function ViewDentalConsultationModal({ record, onClose }) {
  const patientUser = record.patient?.user || {}
  const status = record.status || 'completed'
  const vitals = record.vitals || {}

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '680px' }}>
        <div className="modal-header">
          <h2>Dental Consultation Details</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body read-only-record">
          {/* Patient Info */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Patient Information</h3>
            <div className="detail-grid">
              <div><strong>Name:</strong> {patientUser.name || 'Student'}</div>
              <div><strong>Student / Employee ID:</strong> {patientUser.student_id || EMPTY}</div>
              <div><strong>Email:</strong> {patientUser.email || EMPTY}</div>
              <div><strong>Department:</strong> {patientUser.department || EMPTY}</div>
            </div>
          </div>

          {/* Consultation Overview */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Consultation Overview</h3>
            <div className="detail-grid">
              <div><strong>Consultation Date:</strong> {formatDateLong(record.consultation_date, { month: 'long' })}</div>
              <div><strong>Dental Service:</strong> {serviceLabel(record)}</div>
              <div><strong>Status:</strong> <span className={`status-badge ${status}`} style={{ textTransform: 'capitalize' }}>{status}</span></div>
              <div><strong>Attending Dentist:</strong> {record.dentist?.name || 'Dentist'}</div>
            </div>
          </div>

          {/* Vital Signs */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Vital Signs</h3>
            <div className="detail-grid" style={{ background: 'var(--bg-crust)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div><strong>Blood Pressure:</strong> {vitals.blood_pressure || vitals.bp || EMPTY}</div>
              <div><strong>Temperature:</strong> {vitals.temperature ? `${vitals.temperature} °C` : EMPTY}</div>
              <div><strong>Pulse Rate:</strong> {vitals.pulse_rate ? `${vitals.pulse_rate} bpm` : EMPTY}</div>
              <div><strong>Weight:</strong> {vitals.weight ? `${vitals.weight} kg` : EMPTY}</div>
              <div><strong>Height:</strong> {vitals.height ? `${vitals.height} cm` : EMPTY}</div>
              <div><strong>BMI:</strong> {vitals.bmi ? `${vitals.bmi} kg/m²` : EMPTY}</div>
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
                <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{EMPTY}</span>
              )}
            </div>
          </div>

          {/* Clinical Examination & Findings */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Clinical Findings & Treatment</h3>

            <div className="detail-block" style={{ marginBottom: '0.75rem' }}>
              <strong>Reason for Visit / Chief Complaint:</strong>
              <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                {record.reason_for_visit || EMPTY}
              </div>
            </div>

            {[
              ['Complaint Category', record.complaint_category],
              ['Dental Findings', record.dental_findings],
              ['Diagnosis', record.diagnosis],
              ['Treatment Performed', record.treatment_performed],
              ['Recommendations', record.recommendations],
              ['Patient-Visible Notes', record.notes],
              ['Private Staff Notes', record.staff_notes],
            ].map(([label, value]) => (
              <div className="detail-block" style={{ marginBottom: '0.75rem' }} key={label}>
                <strong>{label}:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', whiteSpace: 'pre-wrap' }}>
                  {value && String(value).trim() ? value : EMPTY}
                </div>
              </div>
            ))}
          </div>

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
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
