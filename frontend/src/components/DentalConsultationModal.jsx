import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { dentalApi } from '../api/dental'
import { recordsApi } from '../api/records'
import { servicesApi } from '../api/services'
import { appointmentsApi } from '../api/appointments'
import { MedicineSupplyPicker } from './MedicineSupplyPicker'
import Dropdown from './Dropdown'
import { formatAppointmentDate } from '../utils/dateUtils'

// FDI Notation Quadrants
const QUADRANTS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft:  [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft:  [31, 32, 33, 34, 35, 36, 37, 38],
}

const CONDITIONS = [
  { key: 'healthy',   label: 'Healthy',            bg: 'var(--green-bg)',  color: 'var(--green)',  border: 'var(--green-border)',  dot: '#16A34A' },
  { key: 'cavity',    label: 'Cavity / Caries',     bg: 'var(--red-bg)',    color: 'var(--red)',    border: 'var(--red-border)',    dot: '#DC2626' },
  { key: 'filled',    label: 'Filled / Restoration',bg: 'var(--blue-bg)',   color: 'var(--blue)',   border: 'var(--blue-border)',   dot: '#2563EB' },
  { key: 'extracted', label: 'Extracted',           bg: '#F1F5F9',          color: '#1E293B',       border: '#CBD5E1',              dot: '#1E293B' },
  { key: 'missing',   label: 'Missing',             bg: '#F8FAFC',          color: '#64748B',       border: '#E2E8F0',              dot: '#64748B' },
  { key: 'treated',   label: 'Crown / Root Canal',  bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-border)', dot: '#D97706' },
]

const CONDITION_MAP = CONDITIONS.reduce((acc, c) => { acc[c.key] = c; return acc }, {})

const deriveDefaultCondition = (serviceName) => {
  const t = (serviceName || '').toLowerCase()
  if (t.includes('extraction') || t.includes('extract') || t.includes('remove')) return 'extracted'
  if (t.includes('filling') || t.includes('restoration') || t.includes('composite')) return 'filled'
  if (t.includes('crown') || t.includes('root canal') || t.includes('treated')) return 'treated'
  if (t.includes('cavity') || t.includes('caries') || t.includes('decay')) return 'cavity'
  return 'healthy'
}

const EMPTY_FORM = {
  patient_id:          '',
  appointment_id:      '',
  consultation_date:   new Date().toISOString().split('T')[0],
  service_name:        '',
  reason_for_visit:    '',
  affected_teeth:      [],
  dental_findings:     '',
  diagnosis:           '',
  treatment_performed: '',
  recommendations:     '',
  notes:               '',
  staff_notes:         '',
  status:              'completed',
}

export function DentalConsultationModal({ initialData, onClose, onSaved }) {
  const prePatientId = initialData?.patient_id || ''
  const prePatientName = initialData?.patient?.name || initialData?.name || ''

  const [form, setForm] = useState({
    ...EMPTY_FORM,
    patient_id:     String(prePatientId),
    appointment_id: String(initialData?.appointment_id || ''),
    service_name:   initialData?.appointment?.service?.name || '',
    reason_for_visit: initialData?.appointment?.notes || '',
  })

  const [patients,      setPatients]      = useState([])
  const [services,      setServices]      = useState([])
  const [appointments,  setAppointments]  = useState([])
  const [teethMap,      setTeethMap]      = useState({})
  const [toothConditions, setToothConditions] = useState({})
  const [saving,        setSaving]        = useState(false)
  const [loadingInit,   setLoadingInit]   = useState(true)
  // Inventory - using new MedicineSupplyPicker component
  const [invRows, setInvRows] = useState([])

  // Load patients & services on mount
  useEffect(() => {
    Promise.allSettled([
      recordsApi.patients(),
      servicesApi.list(),
    ]).then(([pRes, sRes]) => {
      if (pRes.status === 'fulfilled') setPatients(pRes.value.data.patients || [])
      if (sRes.status === 'fulfilled') {
        const all = sRes.value.data.services || sRes.value.data || []
        setServices(all.filter(s =>
          /dental|tooth|teeth|oral|gum|extraction|dentist/i.test(s.name + ' ' + (s.description || ''))
        ))
      }
    }).finally(() => setLoadingInit(false))
  }, [])

  // Load appointments for selected patient (optional link)
  useEffect(() => {
    if (!form.patient_id) { setAppointments([]); return }
    appointmentsApi.list({ patient_id: form.patient_id, appointment_type: 'dental' })
      .then(res => {
        const appts = (res.data.appointments || []).filter(a =>
          a.status === 'confirmed' || a.status === 'pending'
        )
        setAppointments(appts)
      })
      .catch(() => setAppointments([]))
  }, [form.patient_id])

  // Load dental chart for selected patient
  useEffect(() => {
    if (!form.patient_id) { setTeethMap({}); return }
    dentalApi.getChart(form.patient_id)
      .then(res => setTeethMap(res.data.latest_teeth || {}))
      .catch(() => setTeethMap({}))
  }, [form.patient_id])

  const setField = (key, val) => setForm(p => ({ ...p, [key]: val }))

  const handleServiceChange = (name) => {
    setField('service_name', name)
    const def = deriveDefaultCondition(name)
    setToothConditions(prev => {
      const updated = { ...prev }
      form.affected_teeth.forEach(n => { updated[n] = def })
      return updated
    })
  }

  const toggleTooth = (num) => {
    setForm(prev => {
      const exists = prev.affected_teeth.includes(num)
      return {
        ...prev,
        affected_teeth: exists
          ? prev.affected_teeth.filter(t => t !== num)
          : [...prev.affected_teeth, num].sort((a, b) => a - b),
      }
    })
    setToothConditions(prev => {
      if (prev[num]) {
        const copy = { ...prev }; delete copy[num]; return copy
      }
      return { ...prev, [num]: deriveDefaultCondition(form.service_name) }
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.patient_id) { toast.error('Please select a patient.'); return }
    setSaving(true)
    try {
      const res = await dentalApi.createConsultation({
        ...form,
        patient_id:     parseInt(form.patient_id),
        appointment_id: form.appointment_id ? parseInt(form.appointment_id) : null,
        tooth_conditions: toothConditions,
        inventory_items: invRows
          .filter(r => r.item_id && parseInt(r.quantity) > 0)
          .map(r => ({
            item_id: parseInt(r.item_id),
            quantity: parseInt(r.quantity),
            dosage_note: r.dosage_note || null,
          })),
      })
      toast.success('Dental consultation saved & chart updated!')
      onSaved(res.data.consultation || res.data)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save dental consultation.')
    } finally {
      setSaving(false)
    }
  }

  const renderTooth = (num) => {
    const cond   = teethMap[num]?.condition || 'healthy'
    const style  = CONDITION_MAP[cond] || CONDITION_MAP.healthy
    const isSelected = form.affected_teeth.includes(num)
    return (
      <button
        key={num}
        type="button"
        onClick={() => toggleTooth(num)}
        title={`Tooth #${num}: ${style.label}`}
        style={{
          width: '42px', height: '50px',
          borderRadius: 'var(--radius-sm)',
          background: style.bg,
          border: `2px solid ${isSelected ? 'var(--accent)' : style.border}`,
          boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.3)' : 'var(--shadow-xs)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all var(--transition)',
          transform: isSelected ? 'scale(1.07)' : 'scale(1)',
          position: 'relative', outline: 'none',
        }}
      >
        {isSelected && (
          <div style={{
            position: 'absolute', top: '-5px', right: '-5px',
            width: '13px', height: '13px', borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            fontSize: '8px', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✓</div>
        )}
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: style.color }}>#{num}</span>
        <span style={{ fontSize: '0.58rem', fontWeight: 600, color: style.color, textTransform: 'uppercase', marginTop: '1px' }}>
          {cond === 'healthy' ? 'OK' : cond.slice(0, 4)}
        </span>
      </button>
    )
  }

  // Resolve patient display name for prefilled case
  const patientLabel = prePatientName
    ? `${prePatientName}${initialData?.student_id ? ` (${initialData.student_id})` : ''}`
    : null

  return (
    <div
      className="modal-overlay"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-card"
        style={{ maxWidth: '800px', width: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="modal-header">
          <h2>New Dental Consultation</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ overflowY: 'auto', flex: 1 }}>
          {loadingInit ? (
            <div className="table-loading"><div className="loader-ring" /></div>
          ) : (
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

              {/* Section 1 — Patient & Details */}
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>
                  1. Patient & Consultation Details
                </h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Patient *</label>
                    {patientLabel ? (
                      <input disabled value={patientLabel} />
                    ) : (
                      <Dropdown
                        value={String(form.patient_id ?? '')}
                        onChange={v => setField('patient_id', v)}
                        options={patients.map(p => ({
                          value: String(p.id),
                          label: `${p.name} (${p.student_id || p.email})`,
                        }))}
                        placeholder="Select patient"
                        noOptionsMessage="No patients available"
                        required
                      />
                    )}
                  </div>
                  <div className="form-group">
                    <label>Consultation Date *</label>
                    <input
                      type="date"
                      value={form.consultation_date}
                      onChange={e => setField('consultation_date', e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Dental Service</label>
                    <Dropdown
                      value={form.service_name || ''}
                      onChange={v => handleServiceChange(v)}
                      options={services.map(s => ({ value: s.name, label: `${s.name} (${s.duration_minutes}m)` }))}
                      placeholder="Select service"
                    />
                  </div>
                  <div className="form-group">
                    <label>Link to Appointment <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span></label>
                    <Dropdown
                      value={String(form.appointment_id ?? '')}
                      onChange={v => setField('appointment_id', v)}
                      options={[
                        { value: '', label: 'None (Walk-in)' },
                        ...appointments.map(a => ({
                          value: String(a.id),
                          label: `${a.service?.name || 'Appointment'} — ${formatAppointmentDate(a)}`,
                        })),
                      ]}
                      placeholder="None (Walk-in)"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Reason for Visit / Chief Complaint</label>
                  <input
                    type="text"
                    placeholder="e.g. Toothache on upper molar, routine cleaning..."
                    value={form.reason_for_visit}
                    onChange={e => setField('reason_for_visit', e.target.value)}
                  />
                </div>
              </div>

              {/* Section 2 — Affected Teeth */}
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>
                  2. Select Affected Teeth (FDI Notation) — {form.affected_teeth.length} selected
                </h3>

                {/* Legend */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '1rem' }}>
                  {CONDITIONS.map(c => (
                    <div key={c.key} style={{
                      display: 'inline-flex', alignItems: 'center', gap: '0.35rem',
                      padding: '0.2rem 0.55rem', borderRadius: 'var(--radius-full)',
                      background: c.bg, border: `1px solid ${c.border}`, fontSize: '0.7rem',
                    }}>
                      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.dot }} />
                      <span style={{ color: c.color, fontWeight: 600 }}>{c.label}</span>
                    </div>
                  ))}
                </div>

                {/* Odontogram */}
                <div style={{ background: 'var(--bg-crust)', borderRadius: 'var(--radius)', padding: '1rem', border: '1px solid var(--border)' }}>
                  {/* Upper arch */}
                  <div style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                    ── MAXILLARY ARCH (UPPER) ──
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>{QUADRANTS.upperRight.map(n => renderTooth(n))}</div>
                    <div style={{ width: '2px', background: 'var(--accent)', opacity: 0.3 }} title="Midline" />
                    <div style={{ display: 'flex', gap: '0.3rem' }}>{QUADRANTS.upperLeft.map(n => renderTooth(n))}</div>
                  </div>

                  {/* Lower arch */}
                  <div style={{ textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>
                    ── MANDIBULAR ARCH (LOWER) ──
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.3rem' }}>{QUADRANTS.lowerRight.map(n => renderTooth(n))}</div>
                    <div style={{ width: '2px', background: 'var(--accent)', opacity: 0.3 }} title="Midline" />
                    <div style={{ display: 'flex', gap: '0.3rem' }}>{QUADRANTS.lowerLeft.map(n => renderTooth(n))}</div>
                  </div>
                </div>

                {/* Tooth condition per selected tooth */}
                {form.affected_teeth.length > 0 && (
                  <div style={{ marginTop: '1rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
                    {form.affected_teeth.map(num => (
                      <div key={num} style={{
                        background: 'var(--bg-crust)', padding: '0.45rem 0.7rem',
                        borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem',
                      }}>
                        <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent)' }}>Tooth #{num}</span>
                        <Dropdown
                          variant="compact"
                          ariaLabel={`Condition of tooth ${num}`}
                          value={toothConditions[num] || deriveDefaultCondition(form.service_name)}
                          onChange={v => setToothConditions(prev => ({ ...prev, [num]: v }))}
                          options={CONDITIONS.map(c => ({ value: c.key, label: c.label }))}
                          style={{ flex: 1, minWidth: 0 }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Section 3 — Clinical Findings */}
              <div>
                <h3 style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)', marginBottom: '0.75rem' }}>
                  3. Clinical Findings & Treatment
                </h3>
                <div className="form-row">
                  <div className="form-group">
                    <label>Diagnosis</label>
                    <input
                      type="text"
                      placeholder="e.g. Dental Caries, Gingivitis..."
                      value={form.diagnosis}
                      onChange={e => setField('diagnosis', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label>Dental Findings</label>
                    <input
                      type="text"
                      placeholder="e.g. Deep occlusal cavity on tooth #16..."
                      value={form.dental_findings}
                      onChange={e => setField('dental_findings', e.target.value)}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Treatment Performed</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Composite restoration, oral prophylaxis..."
                    value={form.treatment_performed}
                    onChange={e => setField('treatment_performed', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Recommendations</label>
                  <textarea
                    rows="2"
                    placeholder="e.g. Return in 2 weeks, avoid hard food..."
                    value={form.recommendations}
                    onChange={e => setField('recommendations', e.target.value)}
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Patient Notes</label>
                    <textarea
                      rows="2"
                      placeholder="Notes visible to patient"
                      value={form.notes}
                      onChange={e => setField('notes', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label style={{ color: 'var(--red)' }}>Private Notes (Internal Only)</label>
                    <textarea
                      rows="2"
                      placeholder="Hidden from patient"
                      value={form.staff_notes}
                      onChange={e => setField('staff_notes', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Medicines / Supplies Used */}
              <div className="detail-section" style={{ marginTop: '1.25rem' }}>
                <h3 style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.5rem' }}>
                  4. Medicines / Supplies Used
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  Select items dispensed during this consultation. Stock will be automatically deducted.
                </div>
                <MedicineSupplyPicker
                  value={invRows}
                  onChange={setInvRows}
                  isEdit={false}
                  consultationType="dental"
                  consultationId={initialData?.id}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <button type="button" className="btn-ghost" onClick={onClose} disabled={saving}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Consultation'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
