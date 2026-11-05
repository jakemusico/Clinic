import { useEffect, useState } from 'react'
import { servicesApi } from '../api/services'

/**
 * Active services of one kind of care. The API does the filtering (?care_type=), so the Nurse
 * form only ever receives medical services and the Dentist form only dental ones.
 */
export function useCareServices(careType) {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    setLoading(true)
    servicesApi.list({ care_type: careType, active: 1 })
      .then(({ data }) => { if (alive) setServices(data.services || []) })
      .catch(() => { if (alive) setServices([]) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [careType])

  return { services, loading }
}
