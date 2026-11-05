import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { recordsApi } from '../api/records'
import { VITAL_SERVER_KEY } from '../utils/consultation'
import { useCareServices } from './useCareServices'
import { useLinkableAppointments } from './useLinkableAppointments'
import { DRAFT_PREFIX, useConsultationDraft } from './useConsultationDraft'

/**
 * State and loading shared by the Nurse (medical) and Dentist (dental) consultation forms:
 * the form values, patients, the services of this kind of care, the appointments that can be
 * linked, medicines/supplies, field errors, the allergy check and the browser draft.
 *
 * Each form passes its own `initialForm` and builds its own payload.
 */
export function useConsultationForm({ careType, isEdit = false, initialForm }) {
  const { user } = useAuth()
  const reasonKey = careType === 'dental' ? 'reason_for_visit' : 'chief_complaint'

  // What the form looked like when it opened. An untouched form is never saved as a draft.
  const initialRef = useRef(initialForm)

  const [form, setForm] = useState(initialForm)
  const [invRows, setInvRows] = useState([])
  const [errors, setErrors] = useState({})
  const [allergyMatches, setAllergyMatches] = useState([])

  // ── patients ──
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  useEffect(() => {
    let alive = true
    recordsApi.patients()
      .then(({ data }) => { if (alive) setPatients(data.patients || []) })
      .catch(() => { if (alive) setPatients([]) })
      .finally(() => { if (alive) setLoadingPatients(false) })
    return () => { alive = false }
  }, [])
  const selectedPatient = useMemo(
    () => patients.find((p) => String(p.id) === String(form.patient_id)) || null,
    [patients, form.patient_id]
  )

  // ── services (filtered by the API) and appointments that can be linked ──
  const { services, loading: loadingServices } = useCareServices(careType)
  const { appointments, loading: loadingAppointments } = useLinkableAppointments({
    patientId: form.patient_id, careType, enabled: !isEdit,
  })

  const clearError = useCallback((key) => {
    setErrors((p) => {
      const serverKey = VITAL_SERVER_KEY[key]
      if (!p[key] && !(serverKey && p[serverKey])) return p
      const next = { ...p, [key]: '' }
      if (serverKey) next[serverKey] = ''
      return next
    })
  }, [])

  const setField = useCallback((key, value) => {
    setForm((p) => ({ ...p, [key]: value }))
    clearError(key)
  }, [clearError])

  /** Pick (or clear) the linked appointment. The service comes from the appointment and is locked; with none, it is empty again. */
  const selectAppointment = useCallback((app) => {
    setForm((p) => (app
      ? {
        ...p,
        appointment_id: String(app.id),
        service_name: app.service?.name || p.service_name,
        [reasonKey]: p[reasonKey] || app.notes || '',
      }
      : { ...p, appointment_id: '', service_name: '' }))
    clearError('service_name')
  }, [reasonKey, clearError])

  // Opened for an appointment that only arrived as an id: take its service as soon as it is loaded.
  useEffect(() => {
    if (!form.appointment_id || form.service_name) return
    const a = appointments.find((x) => String(x.id) === String(form.appointment_id))
    if (a?.service?.name) {
      // this fill-in is part of the starting state, not something the user typed
      initialRef.current = { ...initialRef.current, service_name: a.service.name }
      setForm((p) => (p.service_name ? p : { ...p, service_name: a.service.name }))
    }
  }, [appointments, form.appointment_id, form.service_name])

  // ── draft (browser auto-save) ──
  const snapshot = useMemo(() => ({ form, invRows }), [form, invRows])
  const pristine = useMemo(
    () => JSON.stringify(snapshot) === JSON.stringify({ form: initialRef.current, invRows: [] }),
    [snapshot]
  )
  const draft = useConsultationDraft({
    storageKey: `${DRAFT_PREFIX}${careType}:${user?.id ?? 'anon'}`,
    enabled: !isEdit,
    snapshot,
    pristine,
  })

  /** Put the saved draft back into the form. Returns the draft data (or null). */
  const restoreDraft = useCallback(() => {
    const data = draft.restore()
    if (!data) return null
    setForm({ ...initialRef.current, ...data.form })
    setInvRows(data.invRows || [])
    setErrors({})
    return data
  }, [draft])

  /** Turn an API error into field errors. Returns them, or null when there were none (a toast is shown). */
  const applyApiError = useCallback((err, fallbackMessage) => {
    const d = err?.response?.data
    if (d?.errors) {
      const flat = {}
      Object.entries(d.errors).forEach(([k, v]) => { flat[k] = Array.isArray(v) ? v[0] : v })
      setErrors(flat)
      return flat
    }
    toast.error(d?.message || fallbackMessage)
    return null
  }, [])

  const scrollToFirstError = useCallback(() => {
    setTimeout(() => {
      document.querySelector('.consult-form .field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }, [])

  return {
    form, setForm, setField, errors, setErrors,
    patients, loadingPatients, selectedPatient,
    services, loadingServices,
    appointments, loadingAppointments, selectAppointment,
    invRows, setInvRows, allergyMatches, setAllergyMatches,
    draft, restoreDraft,
    // locked only once the appointment's service is known (the server also takes it from the appointment)
    reasonKey, serviceLocked: Boolean(form.appointment_id && form.service_name),
    applyApiError, scrollToFirstError,
  }
}
