import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import { dentalApi } from '../api/dental'
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
  COMPLAINT_CATEGORIES, buildVitalsPayload, hasVitals, todayISO, validateVitals,
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
  const [initialForm] = useState(() => buildInitialForm(initialData))

  const c = useConsultationForm({ careType: 'dental', isEdit: false, initialForm })
  const { form, setForm, setField, errors, setErrors } = c

  const [saving, setSaving] = useState(false)
  const [teethMap, setTeethMap] = useState({})
  const [open, setOpen] = useState(() => ({ vitals: true, teeth: false, findings: false, meds: false }))
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

  useEffect(() => {
    if (c.invRows.length > 0) setOpen((o) => (o.meds ? o : { ...o, meds: true }))
  }, [c.invRows.length])

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
    setOpen({ vitals: true, teeth: hasTeeth(data.form), findings: hasFindings(data.form), meds: (data.invRows || []).length > 0 })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    const found = {}
    if (!form.patient_id) found.patient_id = 'Please select the patient.'
    if (!form.service_name) found.service_name = 'Please select the dental service.'
    if (!form.consultation_date) found.consultation_date = 'Please choose the consultation date.'
    if (!form.reason_for_visit.trim()) found.reason_for_visit = 'Please enter the reason for the visit.'
    const vitalErrors = validateVitals(form)
    Object.assign(found, vitalErrors)

    if (Object.keys(found).length) {
      setErrors(found)
      if (Object.keys(vitalErrors).length) setOpen((o) => ({ ...o, vitals: true }))
      toast.error('Please fix the highlighted fields.')
      c.scrollToFirstError()
      return
    }

    setSaving(true)
    setErrors({})

    const def = deriveDefaultCondition(form.service_name)
    const payload = {
      patient_id: parseInt(form.patient_id, 10),
      appointment_id: form.appointment_id ? parseInt(form.appointment_id, 10) : null,
      service_name: form.service_name,
      consultation_date: form.consultation_date,
      reason_for_visit: form.reason_for_visit.trim(),
      complaint_category: form.complaint_category || null,
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
      inventory_items: c.invRows
        .filter((r) => r.item_id && parseInt(r.quantity, 10) > 0)
        .map((r) => ({
          item_id: parseInt(r.item_id, 10),
          quantity: parseInt(r.quantity, 10),
          dosage_note: r.dosage_note || null,
        })),
    }

    try {
      const res = await dentalApi.createConsultation(payload)
      c.draft.clear()
      toast.success('Dental consultation saved & chart updated!')
      onSaved?.(res.data.consultation || res.data)
      onClose?.()
    } catch (err) {
      const flat = c.applyApiError(err, 'Failed to save dental consultation.')
      if (flat) {
        if (Object.keys(flat).some((k) => k.startsWith('vitals'))) setOpen((o) => ({ ...o, vitals: true }))
        if (FINDING_FIELDS.some((k) => flat[k])) setOpen((o) => ({ ...o, findings: true }))
        c.scrollToFirstError()
      }
    } finally {
      setSaving(false)
    }
  }

  const medsBadge = c.allergyMatches.length > 0
    ? '⚠ Allergy warning'
    : (c.invRows.length ? `${c.invRows.length} item${c.invRows.length > 1 ? 's' : ''}` : undefined)

  return (
    <ConsultationFormFrame
      title="New Dental Consultation"
      inline={inline}
      onClose={onClose}
      onSubmit={handleSubmit}
      saving={saving}
      saveLabel="Save & Complete Consultation"
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
          error={errors.patient_id}
        />

        <LinkedAppointmentField
          appointments={c.appointments}
          loading={c.loadingAppointments}
          value={form.appointment_id}
          onSelect={c.selectAppointment}
        />

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
          <FieldLabel required htmlFor="dental-reason">Reason for Visit / Chief Complaint</FieldLabel>
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
          <FieldLabel optional>Complaint Category</FieldLabel>
          <Dropdown
            searchable
            ariaLabel="Complaint category"
            value={form.complaint_category}
            onChange={(v) => setField('complaint_category', v)}
            options={[{ value: '', label: 'No category' }, ...COMPLAINT_CATEGORIES.dental]}
            placeholder="Select a category"
            searchPlaceholder="Search categories…"
            emptyMessage="No category matches your search"
          />
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
          isEdit={false}
          consultationType="dental"
          allergies={c.selectedPatient?.allergies}
          onAllergyMatches={c.setAllergyMatches}
        />
      </CollapsibleSection>
    </ConsultationFormFrame>
  )
}
