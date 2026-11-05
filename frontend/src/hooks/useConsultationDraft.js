import { useCallback, useEffect, useMemo, useState } from 'react'

export const DRAFT_PREFIX = 'clinic:consult-draft:'
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000   // a draft is kept for a week

/** Remove every saved consultation draft (called when the user signs out). */
export const clearAllConsultationDrafts = () => {
  try {
    Object.keys(localStorage).filter((k) => k.startsWith(DRAFT_PREFIX)).forEach((k) => localStorage.removeItem(k))
  } catch { /* storage unavailable */ }
}

const readDraft = (key) => {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft?.data || Date.now() - (draft.savedAt || 0) > MAX_AGE_MS) {
      localStorage.removeItem(key)
      return null
    }
    return draft
  } catch {
    return null
  }
}

/**
 * Auto-saves an unfinished new-consultation form in the browser and offers it back later.
 *
 *   const draft = useConsultationDraft({ storageKey, enabled: !isEdit, snapshot, pristine })
 *   draft.pending   -> { savedAt, data } while a saved draft is waiting for a decision (else null)
 *   draft.restore() -> returns the saved data and closes the offer
 *   draft.discard() -> deletes the saved draft and closes the offer
 *   draft.clear()   -> deletes the saved draft (call after a successful save)
 *
 * Nothing is written while the form is untouched (`pristine`) or while an offer is still open,
 * so the saved draft is never overwritten before the user has chosen what to do with it.
 */
export function useConsultationDraft({ storageKey, enabled = true, snapshot, pristine }) {
  const [pending, setPending] = useState(() => (enabled ? readDraft(storageKey) : null))
  const serialized = useMemo(() => JSON.stringify(snapshot), [snapshot])

  useEffect(() => {
    if (!enabled || pending || pristine) return undefined
    const t = setTimeout(() => {
      try {
        localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), data: JSON.parse(serialized) }))
      } catch { /* storage full or unavailable: skip silently */ }
    }, 700)
    return () => clearTimeout(t)
  }, [enabled, pending, pristine, serialized, storageKey])

  const clear = useCallback(() => {
    try { localStorage.removeItem(storageKey) } catch { /* ignore */ }
  }, [storageKey])

  const restore = useCallback(() => {
    const data = pending?.data ?? null
    setPending(null)
    return data
  }, [pending])

  const discard = useCallback(() => {
    clear()
    setPending(null)
  }, [clear])

  return { pending, restore, discard, clear }
}
