import { useState, useRef, useEffect } from 'react'
import { useDebouncedValue } from '../hooks/useDebouncedValue'

/**
 * Unified Search Toolbar Component
 * 
 * Features:
 * - Rounded pill input with left search icon
 * - Clear (X) button when input has text
 * - Auto-search on typing (300ms debounce) + Enter key support
 * - Optional Filters button with active count badge
 * - Consistent 44px height, styling across all pages
 * 
 * @param {string} value - Current search query
 * @param {function} onChange - Callback when search changes (receives debounced value)
 * @param {string} placeholder - Input placeholder text
 * @param {React.ReactNode} [filterContent] - Filter popover content (if provided, shows Filters button)
 * @param {number} [activeFilterCount] - Number of active filters (shows badge)
 * @param {boolean} [filterOpen] - Whether filter popover is open
 * @param {function} [onFilterToggle] - Callback to toggle filter popover
 * @param {React.Ref} [filterRef] - Ref for filter popover container
 */
export default function SearchToolbar({
  value,
  onChange,
  placeholder = 'Search...',
  filterContent,
  activeFilterCount = 0,
  filterOpen = false,
  onFilterToggle,
  filterRef,
}) {
  const [localValue, setLocalValue] = useState(value)
  const debouncedValue = useDebouncedValue(localValue, 300)

  // Sync external value changes
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // Call onChange with debounced value
  useEffect(() => {
    if (debouncedValue !== value) {
      onChange(debouncedValue)
    }
  }, [debouncedValue]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleInputChange = (e) => {
    setLocalValue(e.target.value)
  }

  const handleClear = () => {
    setLocalValue('')
    onChange('')
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      // Trigger immediate search on Enter (skip debounce)
      onChange(localValue)
    }
  }

  const hasFilters = Boolean(filterContent)

  return (
    <div className="search-toolbar">
      {/* Search Input Box */}
      <div className="search-toolbar-input-box">
        <svg
          className="search-toolbar-icon"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>

        <input
          type="text"
          className="search-toolbar-input"
          placeholder={placeholder}
          value={localValue}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />

        {localValue && (
          <button
            type="button"
            className="search-toolbar-clear"
            onClick={handleClear}
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Filters Button (optional) */}
      {hasFilters && (
        <div className="search-toolbar-filters" ref={filterRef}>
          <button
            type="button"
            className={`search-toolbar-filter-btn ${activeFilterCount > 0 ? 'active' : ''}`}
            onClick={onFilterToggle}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <span className="search-toolbar-filter-badge">{activeFilterCount}</span>
            )}
          </button>

          {/* Filter Popover Content */}
          {filterOpen && (
            <div className="search-toolbar-filter-popover">
              {filterContent}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
