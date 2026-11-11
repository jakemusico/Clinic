import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { recordsApi } from '../api/records'
import { VITAL_SERVER_KEY } from '../utils/consultation'
import { getApiErrorMessage, getFieldErrors } from '../utils/apiError'
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
  // Editing: whether the medicines already dispensed have loaded ('loading' | 'ready' | 'error').
  // Saving an edit before they load would return them all to stock, so the form blocks Save until 'ready'.
  const [itemsStatus, setItemsStatus] = useState(isEdit ? 'loading' : 'ready')

  // ── patients ──
  // The picker calls /clinic/patients?pick=1 (max 50, server-side search) instead of the
  // full directory list. Search results replace the list; the selected patient is kept in a
  // lookup so it stays selected (and keeps its readiness badge) even when it is not in the
  // current search results.
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(true)
  const knownPatients = useRef(new Map())
  const lastSearch = useRef('')
  const searchTimer = useRef(null)
  useEffect(() => {
    patients.forEach((p) => knownPatients.current.set(String(p.id), p))
  }, [patients])
  useEffect(() => () => clearTimeout(searchTimer.current), [])

  const fetchPatients = useCallback(async (search) => {
    const { data } = await recordsApi.patients({ pick: 1, ...(search ? { search } : {}) })
    return data.patients || []
  }, [])

  useEffect(() => {
    let alive = true
    fetchPatients('')
      .then((list) => { if (alive) setPatients(list) })
      .catch(() => { if (alive) setPatients([]) })
      .finally(() => { if (alive) setLoadingPatients(false) })
    return () => { alive = false }
  }, [fetchPatients])

  /** Debounced (300ms) server-side patient search, fired by the picker's search box. */
  const onPatientSearch = useCallback((q) => {
    const search = String(q || '').trim()
    if (search === lastSearch.current) return
    lastSearch.current = search
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      fetchPatients(search)
        .then(setPatients)
        .catch(() => {})   // keep the current list on failure
    }, 300)
  }, [fetchPatients])

  const selectedPatient = useMemo(() => {
    const hit = patients.find((p) => String(p.id) === String(form.patient_id))
    if (hit) return hit
    return form.patient_id ? knownPatients.current.get(String(form.patient_id)) || null : null
  }, [patients, form.patient_id])

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
    const flat = getFieldErrors(err)
    if (Object.keys(flat).length) {
      setErrors(flat)
      return flat
    }
    toast.error(getApiErrorMessage(err, fallbackMessage))
    return null
  }, [])

  const scrollToFirstError = useCallback(() => {
    setTimeout(() => {
      document.querySelector('.consult-form .field-error')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }, [])

  return {
    form, setForm, setField, errors, setErrors,
    patients, loadingPatients, selectedPatient, onPatientSearch,
    services, loadingServices,
    appointments, loadingAppointments, selectAppointment,
    invRows, setInvRows, allergyMatches, setAllergyMatches,
    itemsStatus, setItemsStatus,
    draft, restoreDraft,
    // locked only once the appointment's service is known (the server also takes it from the appointment)
    reasonKey, serviceLocked: Boolean(form.appointment_id && form.service_name),
    applyApiError, scrollToFirstError,
  }
}
