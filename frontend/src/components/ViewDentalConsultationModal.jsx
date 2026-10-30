import PrintableRecord from './PrintableRecord'

export function ViewDentalConsultationModal({ record, onClose }) {
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
          {/* Patient Info */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Patient Information</h3>
            <div className="detail-grid">
              <div><strong>Name:</strong> {patientUser.name || 'Student'}</div>
              <div><strong>Student / Employee ID:</strong> {patientUser.student_id || 'N/A'}</div>
              <div><strong>Email:</strong> {patientUser.email || 'N/A'}</div>
              <div><strong>Department:</strong> {patientUser.department || 'N/A'}</div>
            </div>
          </div>

          {/* Consultation Overview */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Consultation Overview</h3>
            <div className="detail-grid">
              <div><strong>Consultation Date:</strong> {new Date((record.consultation_date?.includes('T') ? record.consultation_date.split('T')[0] : record.consultation_date) + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</div>
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

          {/* Clinical Examination & Findings */}
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
                <strong>Recommendations:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {record.recommendations}
                </div>
              </div>
            )}

            {(record.notes || record.staff_notes) && (
              <div className="detail-block">
                <strong>Additional / Staff Notes:</strong>
                <div className="detail-text" style={{ marginTop: '0.25rem', padding: '0.5rem 0.75rem', background: '#F8FAFC', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  {record.notes || record.staff_notes}
                </div>
              </div>
            )}
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
