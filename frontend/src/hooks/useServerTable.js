import { useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'react-hot-toast'

/**
 * State for a table whose search, filters, sorting and paging are done by the API.
 * Used by the inventory Stock In / Stock Out / Transactions pages so they behave identically.
 *
 *   fetchRows({ search, ...filters, sort_by, sort_dir, page, per_page })
 *       -> Promise<{ rows, total, lastPage }>
 *
 * Rules it enforces:
 *   - any change to search, a filter or the sort goes back to page 1
 *   - typing in the search box is debounced (300 ms)
 *   - a slow, older response can never overwrite a newer one
 *   - if the current page no longer exists (rows were removed) it moves to the last page
 */
export default function useServerTable({
  fetchRows,
  defaultSort,                       // { by: 'date', dir: 'desc' }
  filterDefaults = {},
  errorMessage = 'Failed to load data.',
  initialPageSize = 10,
}) {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch]           = useState('')
  const [filters, setFiltersState]    = useState(filterDefaults)
  const [sortBy, setSortBy]           = useState(defaultSort.by)
  const [sortDir, setSortDir]         = useState(defaultSort.dir)
  const [page, setPage]               = useState(1)
  const [pageSize, setPageSizeState]  = useState(initialPageSize)

  const [rows, setRows]         = useState([])
  const [total, setTotal]       = useState(0)
  const [lastPage, setLastPage] = useState(1)
  const [loading, setLoading]   = useState(true)
  const [loaded, setLoaded]     = useState(false)    // true after the first successful load

  const fetchRef    = useRef(fetchRows)
  const defaultsRef = useRef(filterDefaults)
  const seq         = useRef(0)
  useEffect(() => { fetchRef.current = fetchRows })

  // Debounce the search box
  useEffect(() => {
    const next = searchInput.trim()
    if (next === search) return undefined
    const t = setTimeout(() => { setSearch(next); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [searchInput, search])

  const load = useCallback(async () => {
    const id = ++seq.current
    setLoading(true)
    try {
      const res = await fetchRef.current({
        search, ...filters, sort_by: sortBy, sort_dir: sortDir, page, per_page: pageSize,
      })
      if (id !== seq.current) return                 // a newer request is already in flight
      setRows(res.rows)
      setTotal(res.total)
      setLastPage(res.lastPage)
      setLoaded(true)
      if (res.lastPage >= 1 && page > res.lastPage) setPage(res.lastPage)
    } catch {
      if (id === seq.current) toast.error(errorMessage)
    } finally {
      if (id === seq.current) setLoading(false)
    }
  }, [search, filters, sortBy, sortDir, page, pageSize, errorMessage])

  useEffect(() => { load() }, [load])

  const setFilters = useCallback((patch) => {
    setFiltersState(prev => ({ ...prev, ...patch }))
    setPage(1)
  }, [])

  const setFilter = useCallback((key, value) => setFilters({ [key]: value }), [setFilters])

  // Click on a column header: same column flips the direction, a new column starts ascending
  const handleSort = useCallback((key) => {
    if (key === sortBy) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(key)
      setSortDir('asc')
    }
    setPage(1)
  }, [sortBy])

  const setPageSize = useCallback((size) => { setPageSizeState(size); setPage(1) }, [])

  const hasActiveFilters = Boolean(searchInput.trim())
    || Object.keys(defaultsRef.current).some(k => filters[k] !== defaultsRef.current[k])

  const resetFilters = useCallback(() => {
    setSearchInput('')
    setSearch('')
    setFiltersState(defaultsRef.current)
    setPage(1)
  }, [])

  // Reload, starting from page 1 (e.g. after saving a new record)
  const refreshFromStart = useCallback(() => { if (page !== 1) setPage(1); else load() }, [page, load])

  return {
    rows, total, lastPage, loading, loaded,
    searchInput, setSearchInput, search,       // `search` = the debounced value the table is showing
    filters, setFilter, setFilters,
    sortBy, sortDir, handleSort,
    page, setPage, pageSize, setPageSize,
    hasActiveFilters, resetFilters,
    reload: load, refreshFromStart,
  }
}
