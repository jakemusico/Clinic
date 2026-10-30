import { useState, useMemo } from 'react'

/**
 * Custom hook to handle pagination state for both client-side and server-side data.
 *
 * Client-side usage:
 * const { page, pageSize, totalPages, totalItems, paginatedItems, setPage, setPageSize } = usePagination({ items })
 *
 * Server-side usage:
 * const { page, pageSize, totalPages, totalItems, setPage, setPageSize } = usePagination({ totalItems: serverTotal, serverSide: true })
 */
export function usePagination({
  items = [],
  totalItems: externalTotal,
  initialPage = 1,
  initialPageSize = 10,
  serverSide = false,
} = {}) {
  const [page, setPageState] = useState(initialPage)
  const [pageSize, setPageSizeState] = useState(initialPageSize)

  const totalItems = serverSide
    ? (externalTotal ?? 0)
    : (items?.length ?? 0)

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const paginatedItems = useMemo(() => {
    if (serverSide || !items) return items || []
    const start = (currentPage - 1) * pageSize
    return items.slice(start, start + pageSize)
  }, [items, currentPage, pageSize, serverSide])

  const setPage = (newPage) => {
    setPageState(Math.min(Math.max(1, newPage), totalPages))
  }

  const setPageSize = (newSize) => {
    setPageSizeState(newSize)
    setPageState(1)
  }

  const resetPage = () => {
    setPageState(1)
  }

  return {
    page: currentPage,
    pageSize,
    totalPages,
    totalItems,
    paginatedItems,
    setPage,
    setPageSize,
    resetPage,
  }
}

