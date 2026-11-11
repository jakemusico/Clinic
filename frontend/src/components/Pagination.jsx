import React, { useEffect, useRef } from 'react'
import Dropdown from './Dropdown'

/**
 * Collapsed page numbers generator:
 * For example: [1, '...', 4, 5, 6, '...', 12] or [1, 2, 3, 4, 5, '...', 12]
 */
function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  if (current <= 4) {
    return [1, 2, 3, 4, 5, '...', total]
  }

  if (current >= total - 3) {
    return [1, '...', total - 4, total - 3, total - 2, total - 1, total]
  }

  return [1, '...', current - 1, current, current + 1, '...', total]
}

/**
 * Reusable Unified Pagination Component
 *
 * Layout:
 * - Left: "Showing 1-10 of 56"
 * - Right: rows-per-page dropdown (10, 25, 50) + Previous + page numbers (collapsed) + Next
 *
 * Automatically hides when totalItems <= 0.
 */
export default function Pagination({
  currentPage = 1,
  totalPages = 1,
  totalItems = 0,
  pageSize = 10,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50],
  className = '',
  style = {},
}) {
  const containerRef = useRef(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined
    const root = document.documentElement
    const publish = () => {
      root.style.setProperty('--pagination-height', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    }
    publish()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => {
      ro.disconnect()
      root.style.setProperty('--pagination-height', '0px')
    }
  }, [])

  if (!totalItems || totalItems <= 0) {
    return null
  }

  const from = Math.min((currentPage - 1) * pageSize + 1, totalItems)
  const to = Math.min(currentPage * pageSize, totalItems)
  const pages = getPageNumbers(currentPage, Math.max(1, totalPages))

  return (
    <div className={`pagination-container ${className}`} ref={containerRef} style={style}>
      {/* Left: Summary text */}
      <div className="pagination-info">
        Showing {from}-{to} of {totalItems}
      </div>

      {/* Right: Controls */}
      <div className="pagination-controls">
        {/* Rows per page dropdown */}
        {onPageSizeChange && (
          <div className="pagination-size-wrap">
            <Dropdown
              variant="compact"
              ariaLabel="Rows per page"
              value={pageSize}
              onChange={(v) => onPageSizeChange(Number(v))}
              options={pageSizeOptions.map((opt) => ({ value: opt, label: `${opt} / page` }))}
              style={{ width: '112px', minWidth: 0 }}
            />
          </div>
        )}

        {/* Previous button */}
        <button
          type="button"
          className="pagination-btn pagination-prev"
          disabled={currentPage <= 1}
          onClick={() => onPageChange && onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <span className="pagination-btn-desktop-text">Previous</span>
          <span className="pagination-btn-mobile-text">‹ Prev</span>
        </button>

        {/* Collapsed page numbers */}
        <div className="pagination-numbers">
          {pages.map((p, idx) => {
            if (p === '...') {
              return (
                <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                  …
                </span>
              )
            }

            const isActive = p === currentPage
            return (
              <button
                key={p}
                type="button"
                className={`pagination-btn pagination-num ${isActive ? 'active' : ''}`}
                onClick={() => onPageChange && onPageChange(p)}
                aria-current={isActive ? 'page' : undefined}
              >
                {p}
              </button>
            )
          })}
        </div>

        {/* Next button */}
        <button
          type="button"
          className="pagination-btn pagination-next"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange && onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <span className="pagination-btn-desktop-text">Next</span>
          <span className="pagination-btn-mobile-text">Next ›</span>
        </button>
      </div>
    </div>
  )
}

