import { useEffect, useRef } from 'react'

/**
 * Calls `fn` every `intervalMs`, but only while the browser tab is visible.
 *
 *  - Hidden tab: the timer is stopped, so a background tab makes no requests.
 *  - Tab visible again: `fn` runs right away, then the timer resumes.
 *  - A run that is still in flight is never overlapped by the next one.
 *
 * `whenHidden: true` keeps polling in a hidden tab too (used only for the staff heartbeat,
 * which reports "online" to students).
 *
 * @returns {() => void} stop function
 */
export function poll(fn, intervalMs, { immediate = true, whenHidden = false } = {}) {
  let timer = null
  let stopped = false
  let running = false

  const canRun = () => !stopped && (whenHidden || !document.hidden)

  const schedule = () => {
    clearTimeout(timer)
    timer = canRun() ? setTimeout(tick, intervalMs) : null
  }

  async function tick() {
    if (!canRun() || running) return
    running = true
    try {
      await fn()
    } catch {
      // a failed poll is simply retried on the next tick
    } finally {
      running = false
      schedule()
    }
  }

  const onVisibility = () => {
    if (stopped) return
    if (document.hidden && !whenHidden) {
      clearTimeout(timer)
      timer = null
    } else if (!running) {
      clearTimeout(timer)
      tick()
    }
  }

  document.addEventListener('visibilitychange', onVisibility)
  if (immediate) tick()
  else schedule()

  return () => {
    stopped = true
    clearTimeout(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  }
}

/**
 * Hook form of poll(). Polls only while `enabled` is true (for example while a chat panel is
 * open) and always calls the latest `fn`, so callers do not need to memoise it.
 *
 * @param {() => Promise<void>|void} fn
 * @param {number} intervalMs
 * @param {{enabled?: boolean, immediate?: boolean, whenHidden?: boolean}} [options]
 */
export function usePolling(fn, intervalMs, { enabled = true, immediate = true, whenHidden = false } = {}) {
  const latest = useRef(fn)
  latest.current = fn

  useEffect(() => {
    if (!enabled) return undefined
    return poll(() => latest.current(), intervalMs, { immediate, whenHidden })
  }, [enabled, intervalMs, immediate, whenHidden])
}
