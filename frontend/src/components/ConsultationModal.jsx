import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import useSubmitLock from '../hooks/useSubmitLock'

import { recordsApi } from '../api/records'
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
import { useConsultationForm } from '../hooks/useConsultationForm'
import {
  buildVitalsPayload, hasVitals, todayISO, validateVitals,
} from '../utils/consultation'
import { toDateKey } from '../utils/dateUtils'

const EMPTY_FORM = {
  patient_id: '',
  appointment_id: '',
  visit_date: todayISO(),
  service_name: '',
  chief_complaint: '',
  complaint_category: '',
  // vital signs (all optional)
  bp: '',
  temperature: '',
  pulse_rate: '',
  weight: '',
  height: '',
  // clinical findings (all optional)
  symptoms: '',
  assessment: '',
  diagnosis: '',
  treatment: '',
  prescription: '',
  notes: '',
}

const FINDING_FIELDS = ['symptoms', 'assessment', 'diagnosis', 'treatment', 'prescription', 'notes']
const hasFindings = (f) => FINDING_FIELDS.some((k) => String(f?.[k] ?? '').trim() !== '')
const orNull = (v) => (String(v ?? '').trim() === '' ? null : String(v).trim())
const text = (v) => (v === null || v === undefined ? '' : String(v))

/** New form from what the caller passes in (a person, an appointment, or a saved record when editing). */
function buildInitialForm(initialData) {
  if (!initialData) return { ...EMPTY_FORM }
  const v = initialData.vitals || {}
  return {
    ...EMPTY_FORM,
    patient_id: String(initialData.patient_id || initialData.patient?.id || ''),
    appointment_id: initialData.appointment_id ? String(initialData.appointment_id) : '',
    visit_date: toDateKey(initialData.visit_date) || todayISO(),
    // The service is never pre-selected on a new consultation. It only comes from the
    // appointment the consultation is linked to, or from the saved record being edited.
    service_name: (initialData.appointment_id || initialData.id)
      ? (initialData.service_name || initialData.appointment?.service?.name || '')
      : '',
    chief_complaint: text(initialData.chief_complaint),
    // the dropdown value is the category id; a legacy record only has the name
    complaint_category: initialData.complaint_category_id
      ? String(initialData.complaint_category_id)
      : text(initialData.complaint_category),
    bp: text(v.blood_pressure || v.bp),
    temperature: text(v.temperature),
    pulse_rate: text(v.pulse_rate),
    weight: text(v.weight),
    height: text(v.height),
    symptoms: text(initialData.symptoms),
    assessment: text(initialData.assessment),
    diagnosis: text(initialData.diagnosis),
    treatment: text(initialData.treatment || initialData.recommendation),
    prescription: text(initialData.prescription),
    notes: text(initialData.notes || initialData.remarks),
  }
}

/**
 * New / edit Medical Consultation (Nurse). Shares its building blocks with the Dentist form
 * (components/consultation/*, hooks/useConsultationForm).
 *
 * Required: patient, date, service, complaint category. Everything else is optional.
 */
export function ConsultationModal({ initialData, onClose, onSaved, inline = false }) {
  const isEdit = Boolean(initialData?.id)
  const [initialForm] = useState(() => buildInitialForm(initialData))

  const c = useConsultationForm({ careType: 'medical', isEdit, initialForm })
  const { form, setField, setForm, errors, setErrors } = c

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

  // Complaint categories come from the database (active medical only, in sort order)
  useEffect(() => {
    complaintCategoriesApi.list({ type: 'medical' })
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
  const [open, setOpen] = useState(() => ({ vitals: hasVitals(initialForm), findings: hasFindings(initialForm), meds: false }))
  const toggle = (key) => setOpen((o) => ({ ...o, [key]: !o[key] }))

  // medicines already dispensed (edit) or just added: show the section
  useEffect(() => {
    if (c.invRows.length > 0) setOpen((o) => (o.meds ? o : { ...o, meds: true }))
  }, [c.invRows.length])

  // show the picker's load error even when the Medicines section is folded
  useEffect(() => {
    if (c.itemsStatus === 'error') setOpen((o) => (o.meds ? o : { ...o, meds: true }))
  }, [c.itemsStatus])

  const handleRestoreDraft = () => {
    const data = c.restoreDraft()
    if (!data) return
    setOpen({ vitals: hasVitals(data.form), findings: hasFindings(data.form), meds: (data.invRows || []).length > 0 })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (itemsNotReady) {
      setOpen((o) => ({ ...o, meds: true }))
      toast.error('Please wait until the medicines already dispensed have loaded.')
      return
    }

    // Required fields, then the vital signs that were filled in
    const found = {}
    if (!form.patient_id) found.patient_id = 'Please select the patient.'
    if (!form.service_name) found.service_name = 'Please select the clinic service.'
    if (!form.visit_date) found.visit_date = 'Please choose the consultation date.'
    if (!form.complaint_category) found.complaint_category = 'Please select a complaint category.'
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

    const selectedCategory = categories.find((c) => String(c.id) === form.complaint_category)

    const payload = {
      patient_id: parseInt(form.patient_id, 10),
      appointment_id: form.appointment_id ? parseInt(form.appointment_id, 10) : null,
      service_name: form.service_name,
      visit_date: form.visit_date,
      chief_complaint: orNull(form.chief_complaint),
      complaint_category_id: selectedCategory ? selectedCategory.id : null,
      complaint_category: selectedCategory ? selectedCategory.name : orNull(form.complaint_category),
      vitals: buildVitalsPayload(form),
      symptoms: orNull(form.symptoms),
      assessment: orNull(form.assessment),
      diagnosis: orNull(form.diagnosis),
      treatment: orNull(form.treatment),
      recommendation: orNull(form.treatment),   // the form has one "Treatment / Recommendation" field
      prescription: orNull(form.prescription),
      notes: orNull(form.notes),
      remarks: orNull(form.notes),
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
      const { data } = isEdit
        ? await recordsApi.update(initialData.id, payload)
        : await recordsApi.create(payload)

      c.draft.clear()
      toast.success(data.message || 'Consultation record saved successfully.')
      onSaved(data.record, isEdit)
    } catch (err) {
      const flat = c.applyApiError(err, 'Failed to save consultation.')
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

  // Active categories from the API; a saved value that is not in the list (legacy name or a
  // since-deactivated category) is kept as an extra option so it still displays correctly.
  const categoryOptions = categories.map((cat) => ({ value: String(cat.id), label: cat.name }))
  if (form.complaint_category && !categoryOptions.some((o) => o.value === form.complaint_category)) {
    categoryOptions.unshift({
      value: form.complaint_category,
      label: initialData?.complaint_category || form.complaint_category,
    })
  }

  const medsBadge = c.allergyMatches.length > 0
    ? '⚠ Allergy warning'
    : (c.invRows.length ? `${c.invRows.length} item${c.invRows.length > 1 ? 's' : ''}` : undefined)

  return (
    <ConsultationFormFrame
      title={isEdit ? 'Edit Medical Consultation' : 'New Medical Consultation'}
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
          careType="medical"
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
            careType="medical"
            services={c.services}
            loading={c.loadingServices}
            value={form.service_name}
            onChange={(v) => setField('service_name', v)}
            locked={c.serviceLocked}
            error={errors.service_name}
          />
          <div className="form-group">
            <FieldLabel required htmlFor="consult-date">Consultation Date</FieldLabel>
            <input
              id="consult-date"
              type="date"
              value={form.visit_date}
              max={todayISO()}
              className={errors.visit_date ? 'input-error' : ''}
              onChange={(e) => setField('visit_date', e.target.value)}
            />
            {errors.visit_date && <span className="field-error">{errors.visit_date}</span>}
          </div>
        </div>

        <div className="form-group">
          <FieldLabel optional htmlFor="consult-reason">Reason for Visit / Chief Complaint</FieldLabel>
          <textarea
            id="consult-reason"
            rows={2}
            placeholder="e.g. Severe headache, fever for 2 days, routine physical"
            value={form.chief_complaint}
            className={errors.chief_complaint ? 'input-error' : ''}
            onChange={(e) => setField('chief_complaint', e.target.value)}
          />
          {errors.chief_complaint && <span className="field-error">{errors.chief_complaint}</span>}
        </div>

        <div className="form-group">
          <FieldLabel required htmlFor="consult-category">Complaint Category</FieldLabel>
          <Dropdown
            id="consult-category"
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

      {/* 3 — Clinical findings */}
      <CollapsibleSection
        number={3}
        title="Clinical Findings & Treatment"
        optional
        open={open.findings}
        onToggle={() => toggle('findings')}
        badge={hasFindings(form) ? 'Filled in' : undefined}
      >
        <div className="form-group">
          <FieldLabel optional htmlFor="consult-symptoms">Symptoms</FieldLabel>
          <textarea id="consult-symptoms" rows={2} placeholder="e.g. Dizziness, dry cough, body malaise"
            value={form.symptoms} onChange={(e) => setField('symptoms', e.target.value)} />
        </div>
        <div className="form-row">
          <div className="form-group">
            <FieldLabel optional htmlFor="consult-assessment">Assessment / Findings</FieldLabel>
            <textarea id="consult-assessment" rows={2} placeholder="Clinical assessment and findings..."
              value={form.assessment} onChange={(e) => setField('assessment', e.target.value)} />
          </div>
          <div className="form-group">
            <FieldLabel optional htmlFor="consult-diagnosis">Diagnosis</FieldLabel>
            <textarea id="consult-diagnosis" rows={2} placeholder="Primary diagnosis..."
              value={form.diagnosis} onChange={(e) => setField('diagnosis', e.target.value)} />
            {errors.diagnosis && <span className="field-error">{errors.diagnosis}</span>}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <FieldLabel optional htmlFor="consult-treatment">Treatment / Recommendation</FieldLabel>
            <textarea id="consult-treatment" rows={2} placeholder="Medications given, rest period, treatment advice..."
              value={form.treatment} onChange={(e) => setField('treatment', e.target.value)} />
          </div>
          <div className="form-group">
            <FieldLabel optional htmlFor="consult-prescription">Prescription / Medicines</FieldLabel>
            <textarea id="consult-prescription" rows={2} placeholder="Rx dosage and intake schedule..."
              value={form.prescription} onChange={(e) => setField('prescription', e.target.value)} />
          </div>
        </div>
        <div className="form-group">
          <FieldLabel optional htmlFor="consult-notes">Additional Notes (Patient-Visible)</FieldLabel>
          <textarea id="consult-notes" rows={2} placeholder="Follow-up date, rest instructions, or notes for the student..."
            value={form.notes} onChange={(e) => setField('notes', e.target.value)} />
        </div>
      </CollapsibleSection>

      {/* 4 — Medicines / supplies */}
      <CollapsibleSection
        number={4}
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
          consultationType="medical"
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
