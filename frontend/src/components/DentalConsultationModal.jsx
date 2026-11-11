import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import useSubmitLock from '../hooks/useSubmitLock'
import { dentalApi } from '../api/dental'
import { complaintCategoriesApi } from '../api/complaintCategories'
import { MedicineSupplyPicker } from './MedicineSupplyPicker'
import Dropdown from './Dropdown'
import ConsultationFormFrame from './consultation/ConsultationFormFrame'
import CollapsibleSection from './consultation/CollapsibleSection'
import FieldLabel from './consultation/FieldLabel'
import PatientPicker from './consultation/PatientPicker'
import ServiceField from './consultation/ServiceField'
import LinkedAppointmentField from './consultation/LinkedAppointmentField'
import VitalSignsFields from './consultation/VitalSignsFields'
import DentalTeethSection from './consultation/DentalTeethSection'
import { deriveDefaultCondition } from '../utils/dentalChart'
import { useConsultationForm } from '../hooks/useConsultationForm'
import {
  buildVitalsPayload, hasVitals, todayISO, validateVitals,
} from '../utils/consultation'

const EMPTY_FORM = {
  patient_id: '',
  appointment_id: '',
  consultation_date: todayISO(),
  service_name: '',
  reason_for_visit: '',
  complaint_category: '',
  // vital signs (all optional)
  bp: '',
  temperature: '',
  pulse_rate: '',
  weight: '',
  height: '',
  // teeth (optional)
  affected_teeth: [],
  tooth_conditions: {},
  // clinical findings (all optional)
  dental_findings: '',
  diagnosis: '',
  treatment_performed: '',
  recommendations: '',
  notes: '',
  staff_notes: '',
}

const FINDING_FIELDS = ['dental_findings', 'diagnosis', 'treatment_performed', 'recommendations', 'notes', 'staff_notes']
const hasFindings = (f) => FINDING_FIELDS.some((k) => String(f?.[k] ?? '').trim() !== '')
const hasTeeth = (f) => (f?.affected_teeth || []).length > 0
const orNull = (v) => (String(v ?? '').trim() === '' ? null : String(v).trim())

/** New form from what the caller passes in (a person or an appointment). */
function buildInitialForm(initialData) {
  if (!initialData) return { ...EMPTY_FORM }
  
  // Edit mode: pre-fill everything from existing record
  if (initialData.id) {
    return {
      ...EMPTY_FORM,
      patient_id: String(initialData.patient_id || initialData.patient?.id || ''),
      appointment_id: initialData.appointment_id ? String(initialData.appointment_id) : '',
      consultation_date: initialData.consultation_date || todayISO(),
      service_name: initialData.service_name || initialData.service?.name || '',
      reason_for_visit: initialData.reason_for_visit || '',
      complaint_category: initialData.complaint_category_id
        ? String(initialData.complaint_category_id)
        : (initialData.complaint_category || ''),
      // vital signs
      bp: initialData.vitals?.bp || '',
      temperature: initialData.vitals?.temperature || '',
      pulse_rate: initialData.vitals?.pulse_rate || '',
      weight: initialData.vitals?.weight || '',
      height: initialData.vitals?.height || '',
      // teeth
      affected_teeth: initialData.affected_teeth || [],
      tooth_conditions: initialData.tooth_conditions || {},
      // clinical findings
      dental_findings: initialData.dental_findings || '',
      diagnosis: initialData.diagnosis || '',
      treatment_performed: initialData.treatment_performed || '',
      recommendations: initialData.recommendations || '',
      notes: initialData.notes || '',
      staff_notes: initialData.staff_notes || '',
    }
  }
  
  // New consultation from appointment/patient
  return {
    ...EMPTY_FORM,
    patient_id: String(initialData.patient_id || initialData.patient?.id || ''),
    appointment_id: initialData.appointment_id ? String(initialData.appointment_id) : '',
    // The service is never pre-selected on a new consultation. It only comes from the
    // appointment the consultation is linked to.
    service_name: initialData.appointment_id
      ? (initialData.service_name || initialData.appointment?.service?.name || '')
      : '',
    reason_for_visit: initialData.reason_for_visit || initialData.appointment?.notes || '',
  }
}

/**
 * New Dental Consultation (Dentist). Shares its building blocks with the Nurse form
 * (components/consultation/*, hooks/useConsultationForm).
 *
 * Required: patient, date, service, reason for the visit. Everything else is optional.
 * Use `inline` to show it as a page card instead of a modal.
 */
export function DentalConsultationModal({ initialData, onClose, onSaved, inline = false }) {
  const isEdit = Boolean(initialData?.id)
  const [initialForm] = useState(() => buildInitialForm(initialData))

  const c = useConsultationForm({ careType: 'dental', isEdit, initialForm })
  const { form, setForm, setField, errors, setErrors } = c

  const [saving, setSaving] = useState(false)
  const { lock, unlock } = useSubmitLock()
  const [categories, setCategories] = useState([])
  const [emergency, setEmergency] = useState({ override: false, reason: '' })

  // Walk-in readiness gate: an incomplete patient without a linked appointment needs the override.
  const selectedPatient = c.selectedPatient
  const isWalkIn = !form.appointment_id
  const needsOverride = !isEdit && selectedPatient?.readiness != null && selectedPatient.readiness < 100 && isWalkIn

  useEffect(() => {
    if (!needsOverride) setEmergency({ override: false, reason: '' })
  }, [needsOverride])

  // Complaint categories come from the database (active dental only, in sort order)
  useEffect(() => {
    complaintCategoriesApi.list({ type: 'dental' })
      .then((res) => setCategories(res.data.categories || []))
      .catch(() => setCategories([]))
  }, [])

  // A record saved before categories had ids only carries the name: turn it into the id once loaded
  useEffect(() => {
    if (!categories.length || !form.complaint_category) return
    if (categories.some((c) => String(c.id) === form.complaint_category)) return
    const norm = (s) => { const k = s.toLowerCase().trim(); return k === 'other' ? 'others' : k }
    const match = categories.find((c) => norm(c.name) === norm(form.complaint_category))
    if (match) setForm((p) => ({ ...p, complaint_category: String(match.id) }))
  }, [categories, form.complaint_category, setForm])
  // editing: Save waits until the medicines already dispensed have loaded (see MedicineSupplyPicker)
  const itemsNotReady = isEdit && c.itemsStatus !== 'ready'
  const [teethMap, setTeethMap] = useState({})
  const [open, setOpen] = useState(() => ({ 
    vitals: hasVitals(initialForm), 
    teeth: hasTeeth(initialForm), 
    findings: hasFindings(initialForm), 
    meds: false 
  }))
  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }))

  // current tooth conditions from the patient's dental chart
  useEffect(() => {
    if (!form.patient_id) { setTeethMap({}); return undefined }
    let alive = true
    dentalApi.getChart(form.patient_id)
      .then((res) => { if (alive) setTeethMap(res.data.latest_teeth || {}) })
      .catch(() => { if (alive) setTeethMap({}) })
    return () => { alive = false }
  }, [form.patient_id])

  // medicines already dispensed (edit) or just added: show the section
  useEffect(() => {
    if (c.invRows.length > 0) setOpen((o) => (o.meds ? o : { ...o, meds: true }))
  }, [c.invRows.length])

  // show the picker's load error even when the Medicines section is folded
  useEffect(() => {
    if (c.itemsStatus === 'error') setOpen((o) => (o.meds ? o : { ...o, meds: true }))
  }, [c.itemsStatus])

  // choosing a service suggests a chart condition for the teeth already selected
  const handleServiceChange = (name) => {
    setField('service_name', name)
    const def = deriveDefaultCondition(name)
    setForm((p) => ({
      ...p,
      service_name: name,
      tooth_conditions: Object.fromEntries((p.affected_teeth || []).map((n) => [n, def])),
    }))
  }

  const toggleTooth = (num) => {
    setForm((p) => {
      const selected = p.affected_teeth.includes(num)
      const conditions = { ...p.tooth_conditions }
      if (selected) delete conditions[num]
      else conditions[num] = deriveDefaultCondition(p.service_name)
      return {
        ...p,
        affected_teeth: selected ? p.affected_teeth.filter((t) => t !== num) : [...p.affected_teeth, num].sort((a, b) => a - b),
        tooth_conditions: conditions,
      }
    })
  }

  const setToothCondition = (num, condition) =>
    setForm((p) => ({ ...p, tooth_conditions: { ...p.tooth_conditions, [num]: condition } }))

  const handleRestoreDraft = () => {
    const data = c.restoreDraft()
    if (!data) return
    setOpen({ vitals: hasVitals(data.form), teeth: hasTeeth(data.form), findings: hasFindings(data.form), meds: (data.invRows || []).length > 0 })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (itemsNotReady) {
      setOpen((o) => ({ ...o, meds: true }))
      toast.error('Please wait until the medicines already dispensed have loaded.')
      return
    }

    const found = {}
    if (!form.patient_id) found.patient_id = 'Please select the patient.'
    if (!form.service_name) found.service_name = 'Please select the dental service.'
    if (!form.consultation_date) found.consultation_date = 'Please choose the consultation date.'
    if (!form.complaint_category) found.complaint_category = 'Please select a category'
    const vitalErrors = validateVitals(form)
    Object.assign(found, vitalErrors)

    if (Object.keys(found).length) {
      setErrors(found)
      if (Object.keys(vitalErrors).length) setOpen((o) => ({ ...o, vitals: true }))
      toast.error('Please fix the highlighted fields.')
      c.scrollToFirstError()
      return
    }

    if (needsOverride && emergency.override && !emergency.reason.trim()) {
      setErrors((e) => ({ ...e, emergency_reason: 'Reason for emergency override (required)' }))
      toast.error('Please fix the highlighted fields.')
      return
    }

    if (!lock()) return   // already saving (double click / second Enter): never post twice
    setSaving(true)
    setErrors({})

    const def = deriveDefaultCondition(form.service_name)
    const selectedCategory = categories.find((c) => String(c.id) === form.complaint_category)
    const payload = {
      patient_id: parseInt(form.patient_id, 10),
      appointment_id: form.appointment_id ? parseInt(form.appointment_id, 10) : null,
      service_name: form.service_name,
      consultation_date: form.consultation_date,
      reason_for_visit: orNull(form.reason_for_visit),
      complaint_category_id: selectedCategory ? selectedCategory.id : null,
      complaint_category: selectedCategory ? selectedCategory.name : orNull(form.complaint_category),
      vitals: buildVitalsPayload(form),
      affected_teeth: form.affected_teeth,
      tooth_conditions: Object.fromEntries(form.affected_teeth.map((n) => [n, form.tooth_conditions[n] || def])),
      dental_findings: orNull(form.dental_findings),
      diagnosis: orNull(form.diagnosis),
      treatment_performed: orNull(form.treatment_performed),
      recommendations: orNull(form.recommendations),
      notes: orNull(form.notes),
      staff_notes: orNull(form.staff_notes),
      status: 'completed',
      emergency_override: emergency.override,
      emergency_reason: orNull(emergency.reason),
      inventory_items: c.invRows
        .filter((r) => r.item_id && parseInt(r.quantity, 10) > 0)
        .map((r) => ({
          item_id: parseInt(r.item_id, 10),
          quantity: parseInt(r.quantity, 10),
          dosage_note: r.dosage_note || null,
        })),
    }

    try {
      const res = isEdit
        ? await dentalApi.updateConsultation(initialData.id, payload)
        : await dentalApi.createConsultation(payload)
      
      c.draft.clear()
      toast.success(isEdit ? 'Dental consultation updated successfully!' : 'Dental consultation saved & chart updated!')
      onSaved?.(res.data.consultation || res.data, isEdit)
      onClose?.()
    } catch (err) {
      const flat = c.applyApiError(err, isEdit ? 'Failed to update dental consultation.' : 'Failed to save dental consultation.')
      if (flat) {
        if (Object.keys(flat).some((k) => k.startsWith('vitals'))) setOpen((o) => ({ ...o, vitals: true }))
        if (FINDING_FIELDS.some((k) => flat[k])) setOpen((o) => ({ ...o, findings: true }))
        c.scrollToFirstError()
      }
    } finally {
      setSaving(false)
      unlock()
    }
  }

  const medsBadge = c.allergyMatches.length > 0
    ? '⚠ Allergy warning'
    : (c.invRows.length ? `${c.invRows.length} item${c.invRows.length > 1 ? 's' : ''}` : undefined)

  const categoryOptions = categories.map((cat) => ({ value: String(cat.id), label: cat.name }))
  if (form.complaint_category && !categoryOptions.some((o) => o.value === form.complaint_category)) {
    categoryOptions.unshift({
      value: form.complaint_category,
      label: initialData?.complaint_category || form.complaint_category,
    })
  }

  return (
    <ConsultationFormFrame
      title={isEdit ? 'Edit Dental Consultation' : 'New Dental Consultation'}
      inline={inline}
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      saveDisabled={itemsNotReady || (needsOverride && !emergency.override)}
      saveDisabledHint={needsOverride && !emergency.override
        ? `${selectedPatient?.name}'s profile is only ${selectedPatient?.readiness}% complete`
        : 'Waiting for the medicines already dispensed to load'}
      saveLabel={isEdit ? 'Update Consultation' : 'Save & Complete Consultation'}
      draft={c.draft.pending}
      onRestoreDraft={handleRestoreDraft}
      onDiscardDraft={c.draft.discard}
    >
      {/* 1 — Patient & visit */}
      <CollapsibleSection number={1} title="Patient & Visit Details">
        <PatientPicker
          careType="dental"
          patients={c.patients}
          loading={c.loadingPatients}
          value={form.patient_id}
          onChange={(v) => setField('patient_id', v)}
          locked={isEdit}
          error={errors.patient_id}
          fallback={initialData?.patient?.user ? { ...initialData.patient.user, role: initialData.patient.user.role } : null}
          onSearch={c.onPatientSearch}
        />

        {!isEdit && (
          <LinkedAppointmentField
            appointments={c.appointments}
            loading={c.loadingAppointments}
            value={form.appointment_id}
            onSelect={c.selectAppointment}
          />
        )}

        <div className="form-row">
          <ServiceField
            careType="dental"
            services={c.services}
            loading={c.loadingServices}
            value={form.service_name}
            onChange={handleServiceChange}
            locked={c.serviceLocked}
            error={errors.service_name}
          />
          <div className="form-group">
            <FieldLabel required htmlFor="dental-date">Consultation Date</FieldLabel>
            <input
              id="dental-date"
              type="date"
              value={form.consultation_date}
              max={todayISO()}
              className={errors.consultation_date ? 'input-error' : ''}
              onChange={(e) => setField('consultation_date', e.target.value)}
            />
            {errors.consultation_date && <span className="field-error">{errors.consultation_date}</span>}
          </div>
        </div>

        <div className="form-group">
          <FieldLabel optional htmlFor="dental-reason">Reason for Visit / Chief Complaint</FieldLabel>
          <textarea
            id="dental-reason"
            rows={2}
            placeholder="e.g. Toothache on upper molar, routine cleaning, cavity check..."
            value={form.reason_for_visit}
            className={errors.reason_for_visit ? 'input-error' : ''}
            onChange={(e) => setField('reason_for_visit', e.target.value)}
          />
          {errors.reason_for_visit && <span className="field-error">{errors.reason_for_visit}</span>}
        </div>

        <div className="form-group">
          <FieldLabel required>Complaint Category</FieldLabel>
          <Dropdown
            searchable
            required
            ariaLabel="Complaint category"
            value={form.complaint_category}
            onChange={(v) => setField('complaint_category', v)}
            invalid={Boolean(errors.complaint_category)}
            options={categoryOptions}
            placeholder="Select a category"
            searchPlaceholder="Search categories…"
            emptyMessage="No category matches your search"
          />
          {errors.complaint_category && <span className="field-error">{errors.complaint_category}</span>}
        </div>
      </CollapsibleSection>

      {/* 2 — Vital signs */}
      <CollapsibleSection
        number={2}
        title="Vital Signs"
        optional
        open={open.vitals}
        onToggle={() => toggle('vitals')}
        badge={hasVitals(form) ? 'Filled in' : undefined}
      >
        <VitalSignsFields values={form} errors={errors} onChange={setField} />
      </CollapsibleSection>

      {/* 3 — Affected teeth */}
      <CollapsibleSection
        number={3}
        title="Affected Teeth (FDI Notation)"
        optional
        open={open.teeth}
        onToggle={() => toggle('teeth')}
        badge={hasTeeth(form) ? `${form.affected_teeth.length} selected` : undefined}
      >
        <DentalTeethSection
          teethMap={teethMap}
          selected={form.affected_teeth}
          conditions={form.tooth_conditions}
          serviceName={form.service_name}
          onToggle={toggleTooth}
          onConditionChange={setToothCondition}
        />
      </CollapsibleSection>

      {/* 4 — Clinical findings */}
      <CollapsibleSection
        number={4}
        title="Clinical Findings & Treatment"
        optional
        open={open.findings}
        onToggle={() => toggle('findings')}
        badge={hasFindings(form) ? 'Filled in' : undefined}
      >
        <div className="form-row">
          <div className="form-group">
            <FieldLabel optional htmlFor="dental-diagnosis">Diagnosis</FieldLabel>
            <input id="dental-diagnosis" type="text" placeholder="e.g. Dental Caries, Gingivitis, Impacted Tooth..."
              value={form.diagnosis} onChange={(e) => setField('diagnosis', e.target.value)} />
          </div>
          <div className="form-group">
            <FieldLabel optional htmlFor="dental-findings">Dental Findings</FieldLabel>
            <input id="dental-findings" type="text" placeholder="e.g. Deep occlusal cavity on tooth #16..."
              value={form.dental_findings} onChange={(e) => setField('dental_findings', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <FieldLabel optional htmlFor="dental-treatment">Treatment Performed</FieldLabel>
          <textarea id="dental-treatment" rows={2} placeholder="e.g. Composite restoration, oral prophylaxis..."
            value={form.treatment_performed} onChange={(e) => setField('treatment_performed', e.target.value)} />
        </div>
        <div className="form-group">
          <FieldLabel optional htmlFor="dental-recommendations">Recommendations / Instructions</FieldLabel>
          <textarea id="dental-recommendations" rows={2} placeholder="e.g. Avoid hot food for 2 hours, brush twice daily..."
            value={form.recommendations} onChange={(e) => setField('recommendations', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <FieldLabel optional htmlFor="dental-notes">Patient-Visible Notes</FieldLabel>
            <textarea id="dental-notes" rows={2} placeholder="Notes shown to the patient in the health portal"
              value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
          </div>
          <div className="form-group">
            <FieldLabel optional htmlFor="dental-staff-notes"><span style={{ color: 'var(--red)' }}>Private Notes (Internal Only)</span></FieldLabel>
            <textarea id="dental-staff-notes" rows={2} placeholder="Hidden from the patient"
              value={form.staff_notes} onChange={(e) => setField('staff_notes', e.target.value)} />
          </div>
        </div>
      </CollapsibleSection>

      {/* 5 — Medicines / supplies */}
      <CollapsibleSection
        number={5}
        title="Medicines / Supplies Used"
        optional
        open={open.meds}
        onToggle={() => toggle('meds')}
        badge={medsBadge}
        badgeTone={c.allergyMatches.length > 0 ? 'warn' : undefined}
      >
        <div className="form-hint">Select items dispensed during this consultation. Stock is deducted automatically.</div>
        <MedicineSupplyPicker
          value={c.invRows}
          onChange={c.setInvRows}
          isEdit={isEdit}
          consultationType="dental"
          consultationId={initialData?.id}
          allergies={c.selectedPatient?.allergies}
          onAllergyMatches={c.setAllergyMatches}
          onItemsStatus={c.setItemsStatus}
        />
      </CollapsibleSection>
      {needsOverride && (
        <div style={{ marginTop: '0.5rem', padding: '0.9rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', background: '#FFFFFF' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={emergency.override}
              onChange={e => {
                setEmergency(s => ({ ...s, override: e.target.checked }))
                setErrors((er) => ({ ...er, emergency_reason: '' }))
              }}
            />
            Emergency / urgent case
          </label>
          {emergency.override && (
            <>
              <textarea
                className="form-input"
                rows={3}
                style={{ marginTop: '0.6rem', width: '100%', resize: 'vertical' }}
                placeholder="Reason for emergency override (required)"
                value={emergency.reason}
                onChange={e => {
                  setEmergency(s => ({ ...s, reason: e.target.value }))
                  if (errors.emergency_reason) setErrors((er) => ({ ...er, emergency_reason: '' }))
                }}
              />
              {errors.emergency_reason && <span className="field-error">{errors.emergency_reason}</span>}
            </>
          )}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.4rem 0 0' }}>
            Recorded in the audit log.
          </p>
        </div>
      )}
    </ConsultationFormFrame>
  )
}
