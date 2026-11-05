import { useEffect, useState } from 'react'
import { appointmentsApi } from '../api/appointments'

/** Open (pending / confirmed) appointments of one patient for this kind of care. */
export function useLinkableAppointments({ patientId, careType, enabled = true }) {
  const [appointments, setAppointments] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !patientId) { setAppointments([]); return undefined }
    let alive = true
    setLoading(true)
    appointmentsApi.list({ patient_id: patientId, appointment_type: careType, all: true })
      .then((res) => {
        if (!alive) return
        setAppointments((res.data.appointments || []).filter((a) => a.status === 'confirmed' || a.status === 'pending'))
      })
      .catch(() => { if (alive) setAppointments([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [patientId, careType, enabled])

  return { appointments, loading }
}
