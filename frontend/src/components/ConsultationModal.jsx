import { useEffect, useState, useCallback, useMemo } from 'react'
import { toast } from 'react-hot-toast'

import { recordsApi } from '../api/records'
import { appointmentsApi } from '../api/appointments'
import { servicesApi } from '../api/services'
import { inventoryApi } from '../api/inventory'
import PrintableRecord from './PrintableRecord'

const calcBMI = (weight, height) => {
  if (!weight || !height) return null
  const w = parseFloat(String(weight).replace(/[^0-9.]/g, ''))
  const hCm = parseFloat(String(height).replace(/[^0-9.]/g, ''))
  if (isNaN(w) || isNaN(hCm) || w <= 0 || hCm <= 0) return null
  const hM = hCm / 100
  const bmi = w / (hM * hM)
  return bmi.toFixed(1)
}

const getBMICategory = (bmi) => {
  const v = parseFloat(bmi)
  if (!v) return ''
  if (v < 18.5) return 'Underweight'
  if (v < 25)   return 'Normal weight'
  if (v < 30)   return 'Overweight'
  return 'Obese'
}


const EMPTY_FORM = {
  patient_id: '',
  appointment_id: '',
  visit_date: new Date().toISOString().split('T')[0],
  service_name: '',
  // Vital Signs
  bp: '',
  temperature: '',
  pulse_rate: '',
  weight: '',
  height: '',
  // Consultation Details
  chief_complaint: '',
  complaint_category: '',
  symptoms: '',
  assessment: '',
  diagnosis: '',
  treatment: '',
  recommendation: '',
  notes: '',
}

export function ConsultationModal({ initialData, onClose, onSaved, inline = false }) {
  const isEdit = Boolean(initialData?.id)
  const [form, setForm] = useState(() => {
    if (initialData) {
      const vitals = initialData.vitals || {}
      return {
        ...EMPTY_FORM,
        ...initialData,
        patient_id: initialData.patient_id || initialData.patient?.id || '',
        appointment_id: initialData.appointment_id || '',
        bp: vitals.blood_pressure || vitals.bp || '',
        temperature: vitals.temperature || '',
        pulse_rate: vitals.pulse_rate || '',
        weight: vitals.weight || '',
        height: vitals.height || '',
        assessment: initialData.assessment || initialData.diagnosis || '',
        diagnosis: initialData.diagnosis || initialData.assessment || '',
        recommendation: initialData.recommendation || initialData.treatment || '',
        treatment: initialData.treatment || initialData.recommendation || '',
        notes: initialData.notes || initialData.remarks || '',
        complaint_category: initialData.complaint_category || '',
      }
    }
    return { ...EMPTY_FORM }
  })

  const [patients, setPatients] = useState([])
  const [appointments, setAppointments] = useState([])
  const [services, setServices] = useState([])
  const [selectedPatient, setSelectedPatient] = useState(null)

  const [loadingPatients, setLoadingPatients] = useState(false)
  const [loadingAppointments, setLoadingAppointments] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})
  // Inventory
  const [dispensableItems, setDispensableItems] = useState([])
  const [invRows, setInvRows] = useState([{ item_id: '', quantity: 1 }])

  // Load patients and services
  useEffect(() => {
    setLoadingPatients(true)
    Promise.allSettled([
      recordsApi.patients(),
      servicesApi.list(),
    ]).then(([pRes, sRes]) => {
      if (pRes.status === 'fulfilled') {
        const pts = pRes.value.data.patients || []
        setPatients(pts)
        if (!form.patient_id && pts.length > 0 && !isEdit) {
          setForm(p => ({ ...p, patient_id: pts[0].id }))
        }
      }
      if (sRes.status === 'fulfilled') {
        setServices(sRes.value.data.services || sRes.value.data || [])
      }
    }).finally(() => setLoadingPatients(false))
  }, [isEdit])

  // Load dispensable inventory items
  useEffect(() => {
    inventoryApi.dispensable()
      .then(({ data }) => setDispensableItems(data.items || []))
      .catch(() => {})

    // For edits, load existing dispensed items
    if (isEdit && initialData?.id) {
      inventoryApi.consultationItems('medical', initialData.id)
        .then(({ data }) => {
          const rows = (data.items || []).map(i => ({ item_id: String(i.item_id), quantity: i.quantity }))
          if (rows.length > 0) setInvRows(rows)
        })
        .catch(() => {})
    }
  }, [isEdit, initialData?.id])

  // Update selected patient info
  useEffect(() => {
    if (form.patient_id && patients.length > 0) {
      const found = patients.find(p => String(p.id) === String(form.patient_id))
      setSelectedPatient(found || null)
    }
  }, [form.patient_id, patients])

  // Load active appointments for selected patient
  useEffect(() => {
    if (form.patient_id && !isEdit) {
      setLoadingAppointments(true)
      appointmentsApi.list({ patient_id: form.patient_id })
        .then(res => {
          const apps = (res.data.appointments || []).filter(
            a => a.status === 'confirmed' || a.status === 'pending'
          )
          setAppointments(apps)
          // Pre-select if appointment matches
          if (initialData?.appointment_id) {
            const match = apps.find(a => String(a.id) === String(initialData.appointment_id))
            if (match) {
              setForm(p => ({
                ...p,
                appointment_id: match.id,
                service_name: match.service?.name || p.service_name,
              }))
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoadingAppointments(false))
    }
  }, [form.patient_id, isEdit, initialData])

  const setField = (key, val) => {
    setForm(p => ({ ...p, [key]: val }))
    setErrors(p => ({ ...p, [key]: '' }))
  }

  const handleAppointmentSelect = (appId) => {
    setField('appointment_id', appId)
    if (appId) {
      const app = appointments.find(a => String(a.id) === String(appId))
      if (app) {
        setForm(p => ({
          ...p,
          appointment_id: app.id,
          service_name: app.service?.name || p.service_name,
          chief_complaint: app.notes || p.chief_complaint,
        }))
      }
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setErrors({})

    const calculatedBmi = calcBMI(form.weight, form.height)
    const vitalsPayload = {
      blood_pressure: form.bp,
      bp: form.bp,
      temperature: form.temperature,
      pulse_rate: form.pulse_rate,
      weight: form.weight,
      height: form.height,
      bmi: calculatedBmi,
    }

    const payload = {
      patient_id: parseInt(form.patient_id),
      appointment_id: form.appointment_id ? parseInt(form.appointment_id) : null,
      visit_date: form.visit_date,
      chief_complaint: form.chief_complaint,
      complaint_category: form.complaint_category || null,
      symptoms: form.symptoms,
      assessment: form.assessment || form.diagnosis,
      diagnosis: form.diagnosis || form.assessment || 'General Consultation',
      treatment: form.treatment || form.recommendation,
      recommendation: form.recommendation || form.treatment,
      prescription: form.prescription || null,
      notes: form.notes,
      remarks: form.notes || form.remarks,
      vitals: vitalsPayload,
      inventory_items: invRows
        .filter(r => r.item_id && parseInt(r.quantity) > 0)
        .map(r => ({ item_id: parseInt(r.item_id), quantity: parseInt(r.quantity) })),
    }

    try {
      const { data } = isEdit
        ? await recordsApi.update(initialData.id, payload)
        : await recordsApi.create(payload)

      toast.success(data.message || 'Consultation record saved successfully.')
      onSaved(data.record, isEdit)
    } catch (err) {
      const d = err?.response?.data
      if (d?.errors) {
        const flat = {}
        Object.entries(d.errors).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? v[0] : v })
        setErrors(flat)
      } else {
        toast.error(d?.message || 'Failed to save consultation.')
      }
    } finally {
      setSaving(false)
    }
  }

  const cardBody = (
    <div className={inline ? "data-table-wrap" : "modal-card"} style={inline ? { width: '100%', maxWidth: '100%', padding: '1.5rem', background: '#FFFFFF' } : { maxWidth: '680px' }}>
      <div className="modal-header" style={inline ? { paddingBottom: '1rem', borderBottom: '1px solid var(--border)', marginBottom: '1.25rem' } : {}}>
        <h2>{isEdit ? 'Edit Medical Consultation' : 'New Patient Consultation'}</h2>
        <button className={inline ? "btn-secondary" : "modal-close"} onClick={onClose} type="button" style={inline ? { fontSize: '0.8rem', padding: '0.35rem 0.75rem' } : {}}>
          {inline ? 'Back to Logs' : '✕'}
        </button>
      </div>

      <form onSubmit={handleSubmit} className={inline ? "" : "modal-body"}>

          {/* Section 1: Patient Information */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700 }}>1. Patient Information</h3>
            
            {!isEdit ? (
              <div className="form-group">
                <label>Select Patient / Student</label>
                {loadingPatients ? (
                  <input disabled value="Loading patients..." />
                ) : (
                  <select value={form.patient_id} onChange={e => setField('patient_id', e.target.value)}>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.student_id || 'No ID'}) — {p.email}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div className="form-group">
                <label>Patient</label>
                <input disabled value={`${form.patient?.user?.name || selectedPatient?.name || 'Patient'} (${selectedPatient?.email || ''})`} />
              </div>
            )}

            {/* Read-only patient badge preview */}
            {selectedPatient && (
              <div style={{ background: 'var(--bg-crust)', padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', border: '1px solid var(--border)' }}>
                <div><strong>Student / Employee ID:</strong> {selectedPatient.student_id || 'N/A'}</div>
                <div><strong>Department:</strong> {selectedPatient.department || 'N/A'}</div>
                <div><strong>Contact No:</strong> {selectedPatient.contact_no || 'N/A'}</div>
                <div><strong>Role:</strong> {selectedPatient.role || 'Student'}</div>
              </div>
            )}

            {!isEdit && (
              <div className="form-group">
                <label>Link to Appointment (Optional)</label>
                {loadingAppointments ? (
                  <input disabled value="Checking active appointments..." />
                ) : (
                  <select value={form.appointment_id} onChange={e => handleAppointmentSelect(e.target.value)}>
                    <option value="">Direct consultation (no appointment link)</option>
                    {appointments.map(a => (
                      <option key={a.id} value={a.id}>
                        #{a.id} - {a.service?.name || 'General Visit'} ({new Date(a.scheduled_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                )}
                <span className="form-hint">Completing this consultation automatically sets appointment status to Completed.</span>
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>Clinic Service</label>
                <select
                  value={form.service_name}
                  onChange={e => setField('service_name', e.target.value)}
                >
                  <option value="">Select clinic service</option>
                  {services.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.duration_minutes}m)
                    </option>
                  ))}
                  {form.service_name && !services.some(s => s.name === form.service_name) && (
                    <option value={form.service_name}>{form.service_name}</option>
                  )}
                </select>
              </div>
              <div className="form-group">
                <label>Consultation Date</label>
                <input
                  type="date"
                  value={form.visit_date}
                  onChange={e => setField('visit_date', e.target.value)}
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Vital Signs */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700 }}>2. Vital Signs</h3>
            
            <div className="form-row">
              <div className="form-group">
                <label>Blood Pressure</label>
                <input
                  type="text"
                  placeholder="e.g. 120/80 mmHg"
                  value={form.bp}
                  onChange={e => setField('bp', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Temperature (°C)</label>
                <input
                  type="text"
                  placeholder="e.g. 36.6 °C"
                  value={form.temperature}
                  onChange={e => setField('temperature', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Pulse Rate (bpm)</label>
                <input
                  type="text"
                  placeholder="e.g. 75 bpm"
                  value={form.pulse_rate}
                  onChange={e => setField('pulse_rate', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Weight (kg)</label>
                <input
                  type="text"
                  placeholder="e.g. 62 kg"
                  value={form.weight}
                  onChange={e => setField('weight', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Height (cm) — Optional</label>
                <input
                  type="text"
                  placeholder="e.g. 168 cm"
                  value={form.height}
                  onChange={e => setField('height', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Body Mass Index (BMI)</label>
                <input
                  type="text"
                  readOnly
                  tabIndex="-1"
                  value={
                    calcBMI(form.weight, form.height)
                      ? `${calcBMI(form.weight, form.height)} (${getBMICategory(calcBMI(form.weight, form.height))})`
                      : '—'
                  }
                  style={{
                    background: 'var(--bg-crust, #F8FAFC)',
                    fontWeight: 600,
                    color: calcBMI(form.weight, form.height) ? 'var(--accent, #2563EB)' : 'var(--text-muted, #94A3B8)',
                    cursor: 'not-allowed'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Section 3: Consultation Details */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700 }}>3. Consultation Details</h3>

            <div className="form-group">
              <label>Reason for Visit / Chief Complaint</label>
              <textarea
                rows={2}
                placeholder="e.g. Severe headache, fever for 2 days, routine physical"
                value={form.chief_complaint}
                onChange={e => setField('chief_complaint', e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Complaint Category</label>
              <select
                value={form.complaint_category || ''}
                onChange={e => setField('complaint_category', e.target.value)}
              >
                <option value="">-- Select Category --</option>
                <option value="Fever/Flu">Fever/Flu</option>
                <option value="Headache">Headache</option>
                <option value="Cough/Colds">Cough/Colds</option>
                <option value="Stomach Pain">Stomach Pain</option>
                <option value="Injury/Wound">Injury/Wound</option>
                <option value="Allergy">Allergy</option>
                <option value="Dizziness/BP">Dizziness/BP</option>
                <option value="Toothache">Toothache</option>
                <option value="Dental Cleaning">Dental Cleaning</option>
                <option value="Extraction">Extraction</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label>Symptoms</label>
              <textarea
                rows={2}
                placeholder="e.g. Dizziness, dry cough, body malaise"
                value={form.symptoms}
                onChange={e => setField('symptoms', e.target.value)}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Assessment / Findings</label>
                <textarea
                  rows={2}
                  placeholder="Clinical assessment and findings..."
                  value={form.assessment}
                  onChange={e => setField('assessment', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Diagnosis</label>
                <textarea
                  rows={2}
                  placeholder="Primary diagnosis..."
                  value={form.diagnosis}
                  onChange={e => setField('diagnosis', e.target.value)}
                  required
                />
                {errors.diagnosis && <span className="field-error">{errors.diagnosis}</span>}
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Treatment / Recommendation</label>
                <textarea
                  rows={2}
                  placeholder="Medications given, rest period, treatment advice..."
                  value={form.treatment}
                  onChange={e => setField('treatment', e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Prescription / Medicines</label>
                <textarea
                  rows={2}
                  placeholder="Rx dosage and intake schedule..."
                  value={form.prescription}
                  onChange={e => setField('prescription', e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Additional Notes (Patient-Visible)</label>
              <textarea
                rows={2}
                placeholder="Follow-up date, rest instructions, or notes for the student..."
                value={form.notes}
                onChange={e => setField('notes', e.target.value)}
              />
            </div>
          </div>

          {/* Section: Medicines / Supplies Used */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700 }}>4. Medicines / Supplies Used</h3>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Select items dispensed during this consultation. Stock will be automatically deducted.
            </div>
            {invRows.map((row, idx) => {
              const selectedInv = dispensableItems.find(i => String(i.id) === String(row.item_id))
              return (
                <div key={idx} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap' }}>
                  <select
                    value={row.item_id}
                    onChange={e => setInvRows(p => p.map((r, i) => i === idx ? { ...r, item_id: e.target.value } : r))}
                    style={{ flex: '1 1 200px', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}
                  >
                    <option value="">— Select item —</option>
                    {dispensableItems.map(i => (
                      <option key={i.id} value={i.id} disabled={!i.has_stock}>
                        {i.name} ({i.category}) — {i.current_stock} {i.unit} available
                      </option>
                    ))}
                  </select>
                  <input
                    type="number" min="1"
                    value={row.quantity}
                    onChange={e => setInvRows(p => p.map((r, i) => i === idx ? { ...r, quantity: e.target.value } : r))}
                    style={{ width: '80px', padding: '0.45rem 0.6rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem' }}
                    placeholder="Qty"
                  />
                  {selectedInv && (
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {selectedInv.unit}
                    </span>
                  )}
                  {invRows.length > 1 && (
                    <button type="button" onClick={() => setInvRows(p => p.filter((_, i) => i !== idx))}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1rem', padding: '0 4px' }}>
                      ✕
                    </button>
                  )}
                </div>
              )
            })}
            <button type="button" className="btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.75rem', marginTop: '0.25rem' }}
              onClick={() => setInvRows(p => [...p, { item_id: '', quantity: 1 }])}>
              + Add Item
            </button>
          </div>

          <div className="modal-footer" style={inline ? { marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' } : {}}>
            <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? <span className="btn-spinner" /> : (isEdit ? 'Update Consultation' : 'Save & Complete Consultation')}
            </button>
          </div>
        </form>
      </div>
  )

  if (inline) {
    return cardBody
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      {cardBody}
    </div>
  )
}

function ViewConsultationModal({ record, onClose, onEdit }) {
  const vitals = record.vitals || {}
  const patientUser = record.patient?.user || {}
  const status = record.status || 'completed'

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
          
          {/* Patient Header */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Patient Information</h3>
            <div className="detail-grid">
              <div><strong>Name:</strong> {patientUser.name || 'Student'}</div>
              <div><strong>Student / Employee ID:</strong> {patientUser.student_id || 'N/A'}</div>
              <div><strong>Email:</strong> {patientUser.email || 'N/A'}</div>
              <div><strong>Department:</strong> {patientUser.department || 'N/A'}</div>
            </div>
          </div>

          {/* Visit Summary */}
          <div className="detail-section">
            <h3 style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '0.6rem' }}>Consultation Overview</h3>
            <div className="detail-grid">
              <div><strong>Consultation Date:</strong> {new Date(record.visit_date).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })}</div>
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

          {/* Clinical Findings */}
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

          <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
            {onEdit && (
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  onClose()
                  onEdit(record)
                }}
              >
                Edit Record
              </button>
            )}
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

