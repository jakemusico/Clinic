import { useCallback, useRef } from 'react'

/**
 * Stops a form from being submitted twice.
 *
 * `disabled={saving}` is not enough: setSaving(true) only takes effect on the next render, so a
 * double click or a second Enter press can run the handler again before the button is disabled.
 * A ref changes immediately, so the second call is turned away.
 *
 *   const { lock, unlock } = useSubmitLock()
 *
 *   const handleSubmit = async (e) => {
 *     e.preventDefault()
 *     ...validation (return on error)...
 *     if (!lock()) return          // a save is already running
 *     setSaving(true)
 *     try { await api.save(...) }
 *     finally { setSaving(false); unlock() }
 *   }
 */
export default function useSubmitLock() {
  const busy = useRef(false)

  /** true when this call got the lock; false when a submit is already in flight. */
  const lock = useCallback(() => {
    if (busy.current) return false
    busy.current = true
    return true
  }, [])

  const unlock = useCallback(() => {
    busy.current = false
  }, [])

  return { lock, unlock }
}
