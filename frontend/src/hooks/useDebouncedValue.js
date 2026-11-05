import { useEffect, useState } from 'react'

/**
 * Returns `value` after it has stopped changing for `delay` ms.
 *
 * For search boxes: keep the input bound to the live value so typing feels instant, and use the
 * debounced value for the filtering or the request, so a fast typist triggers one filter pass
 * (or one API call) instead of one per keystroke.
 *
 * @example
 *   const [search, setSearch] = useState('')
 *   const debouncedSearch = useDebouncedValue(search)
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])

  return debounced
}
