import { useEffect, useMemo, useRef } from 'react'

/** True when the error is a request that was cancelled on purpose (see useLatestRequest). */
export function isRequestCanceled(err) {
  return err?.code === 'ERR_CANCELED' || err?.name === 'CanceledError' || err?.name === 'AbortError'
}

/**
 * Protects a screen from out-of-order responses: when the user types, filters or changes page quickly,
 * a slow OLD response must not replace the newer one.
 *
 *   const latest = useLatestRequest()
 *
 *   const load = async () => {
 *     const req = latest.begin()                       // cancels the request that is still running
 *     setLoading(true)
 *     try {
 *       const { data } = await api.get(url, { params, signal: req.signal })
 *       if (!req.isCurrent()) return                   // a newer request has started since
 *       setRows(data.rows)
 *     } catch (err) {
 *       if (isRequestCanceled(err) || !req.isCurrent()) return
 *       toast.error(getApiErrorMessage(err))
 *     } finally {
 *       if (req.isCurrent()) setLoading(false)
 *     }
 *   }
 *
 * `latest.cancel()` drops whatever is running without starting anything (e.g. the search box was cleared).
 * Leaving the screen cancels the running request too.
 */
export default function useLatestRequest() {
  const controller = useRef(null)
  const seq = useRef(0)

  useEffect(() => () => {
    controller.current?.abort()
    seq.current += 1
  }, [])

  return useMemo(() => ({
    begin() {
      controller.current?.abort()
      const c = new AbortController()
      controller.current = c
      const id = ++seq.current
      return { signal: c.signal, isCurrent: () => id === seq.current }
    },
    cancel() {
      controller.current?.abort()
      controller.current = null
      seq.current += 1
    },
  }), [])
}
