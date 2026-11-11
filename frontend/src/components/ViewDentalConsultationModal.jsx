import { ModalFooter } from './ModalFooter'
import { EMPTY, serviceLabel } from '../utils/emptyValue'
import { formatDateLong } from '../utils/dateUtils'

export function ViewDentalConsultationModal({ record, onClose, onEdit }) {
  const patientUser = record.patient?.user || {}
  const status = record.status || 'completed'
  const vitals = record.vitals || {}

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: '700px', padding: 0, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: '1rem', margin: 0, fontWeight: 700 }}>Dental Consultation Details</h2>
          <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
            {onEdit && (
              <button className="btn-primary" style={{ padding: '0.35rem 0.85rem', fontSize: '0.8rem' }} onClick={() => onEdit(record)}>
                Edit
              </button>
            )}
            <button className="modal-close" onClick={onClose}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ padding: '1.25rem', overflowY: 'auto', flexGrow: 1 }}>
          {/* Patient Info */}
          <div className="detail-section">
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', borderBottom: '1px solid var(--accent-light)', paddingBottom: '0.35rem', marginBottom: '0.75rem', marginTop: 0 }}>Patient Information</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem 1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Full Name</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                  {patientUser.name || 'Student'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Student / Employee ID</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                  {patientUser.student_id || EMPTY}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Email</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                  {patientUser.email || EMPTY}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Department / Course</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                  {patientUser.department || EMPTY}
                </div>
              </div>
            </div>
          </div>

          {/* Consultation Overview */}
          <div className="detail-section">
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', borderBottom: '1px solid var(--accent-light)', paddingBottom: '0.35rem', marginBottom: '0.75rem', marginTop: '1.25rem' }}>Consultation Overview</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem 1.25rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Date</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                  {formatDateLong(record.consultation_date, { month: 'long' })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Dental Service</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                  {serviceLabel(record)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Attending Dentist</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                  {record.dentist?.name || 'Dentist'}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Status</div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                  <span className="status-badge completed" style={{ textTransform: 'capitalize', fontSize: '0.75rem' }}>
                    {status}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Vital Signs */}
          <div className="detail-section">
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', borderBottom: '1px solid var(--accent-light)', paddingBottom: '0.35rem', marginBottom: '0.75rem', marginTop: '1.25rem' }}>Vital Signs</h3>
            <div style={{ background: 'var(--bg-sub)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '0.85rem 1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.65rem 1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Blood Pressure</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                    {vitals.blood_pressure || vitals.bp || EMPTY}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Temperature</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                    {vitals.temperature ? `${vitals.temperature} °C` : EMPTY}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Pulse Rate</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                    {vitals.pulse_rate ? `${vitals.pulse_rate} bpm` : EMPTY}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Weight</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                    {vitals.weight ? `${vitals.weight} kg` : EMPTY}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>Height</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--text)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                    {vitals.height ? `${vitals.height} cm` : EMPTY}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>BMI</div>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent)', borderBottom: '1px solid var(--border)', paddingBottom: '3px', minHeight: '20px' }}>
                    {vitals.bmi ? `${vitals.bmi} kg/m²` : EMPTY}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Affected Teeth */}
          <div className="detail-section">
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', borderBottom: '1px solid var(--accent-light)', paddingBottom: '0.35rem', marginBottom: '0.75rem', marginTop: '1.25rem' }}>Affected Teeth (FDI Notation)</h3>
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
            <h3 style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--accent)', borderBottom: '1px solid var(--accent-light)', paddingBottom: '0.35rem', marginBottom: '0.75rem', marginTop: '1.25rem' }}>Clinical Findings & Treatment</h3>

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

          <ModalFooter
            record={record}
            patientUser={patientUser}
            isDental={true}
            onClose={onClose}
          />
        </div>
      </div>
    </div>
  )
}
