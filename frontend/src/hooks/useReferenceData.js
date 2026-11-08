import { useEffect, useState } from 'react'
import { referenceApi } from '../api/reference'

const asList = (res) => (Array.isArray(res?.data) ? res.data : [])

/**
 * Sections and grade levels for the pickers (Register, Profile, User Management).
 * Read through the shared cache: opening several screens in a row asks the server once
 * (then again after 5 minutes). Resolves to empty lists when the server cannot be reached;
 * the pickers then simply have no options, as before.
 */
export function useSectionsAndGradeLevels() {
  const [sections, setSections] = useState([])
  const [gradeLevels, setGradeLevels] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let alive = true
    Promise.all([
      referenceApi.sections().then(asList).catch(() => []),
      referenceApi.gradeLevels().then(asList).catch(() => []),
    ]).then(([s, g]) => {
      if (!alive) return
      setSections(s)
      setGradeLevels(g)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  return { sections, gradeLevels, loading }
}
