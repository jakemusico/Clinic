import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * The one dropdown used across the whole app (filters, form fields, modals, rows-per-page …).
 * It replaces every native <select>. The trigger is a <button>, so nothing in it can be
 * text-selected, and the list opens in a rounded panel that is rendered in <body> (it is never
 * clipped by a table card or a scrolling modal).
 *
 * Lists with more than 8 options (DROPDOWN_SEARCH_THRESHOLD) automatically get a search box at
 * the top of the panel; force it on or off with `searchable`.
 *
 * Props
 *   options       [{ value, label, badge?, sublabel?, tone?, tag?, highlighted?, disabled? }]  (plain strings also work)
 *                   label        main text (searched)
 *                   badge        small text under the name, e.g. the item category (searched)
 *                   sublabel     text on the right, e.g. "120 tablets" available stock
 *                   tone         'low' | 'out' colors the sublabel amber / red
 *                   tag          short accent text beside the name, e.g. "✓ Added"
 *                   highlighted  accent background (e.g. already added)
 *                   disabled     visible but not selectable
 *   value         selected option value ('' = nothing selected). Compared as a string.
 *   onChange      (value, option) => void.  `value` is always a string.
 *   placeholder   text shown when no option matches `value`
 *   disabled      disables the whole control
 *   invalid       error state (red border); `error` is an alias
 *
 * Optional
 *   searchable         true | false to override the "more than 8 options" rule
 *   searchPlaceholder  placeholder of the search box                 (default "Search…")
 *   emptyMessage       shown when the search matches nothing         (default "No results found")
 *   noOptionsMessage   shown when there are no options at all        (default = emptyMessage)
 *   loading            show "Loading…" instead of the list
 *   required           blocks form submit while nothing is selected
 *   id, name, ariaLabel
 *   variant            'form' (default, like .form-group inputs) | 'filter' (40px toolbar filter) |
 *                      'compact' (small, like the dashboard period filter / rows-per-page) |
 *                      'plain' (the className supplies the look, e.g. profile-input)
 *   className          extra class on the trigger button
 *   style              style on the wrapper (e.g. { minWidth: 190 })
 *
 * Keyboard: ArrowDown / ArrowUp open and move, Home / End jump, Enter (or Space) selects, Escape
 * closes and returns focus to the button, Tab leaves. Typing a letter jumps to a matching option.
 */

export const DROPDOWN_SEARCH_THRESHOLD = 8

const str = (v) => (v === null || v === undefined ? '' : String(v))

const normalize = (options) =>
  (options || []).map((o) =>
    typeof o === 'object' && o !== null
      ? { ...o, value: str(o.value), label: o.label ?? str(o.value) }
      : { value: str(o), label: str(o) }
  )

const matches = (o, q) =>
  str(o.label).toLowerCase().includes(q) || str(o.badge).toLowerCase().includes(q)

const firstEnabled = (items, from = 0, step = 1) => {
  for (let i = from; i >= 0 && i < items.length; i += step) if (!items[i].disabled) return i
  return -1
}

const samePos = (a, b) =>
  a && b && a.left === b.left && a.width === b.width && a.maxHeight === b.maxHeight &&
  a.up === b.up && a.top === b.top && a.bottom === b.bottom

export default function Dropdown({
  options = [],
  value = '',
  onChange,
  placeholder = 'Select…',
  disabled = false,
  invalid = false,
  error = false,
  searchable,
  searchPlaceholder = 'Search…',
  emptyMessage = 'No results found',
  noOptionsMessage,
  loading = false,
  /** Called with the raw search text whenever it changes (for server-side search). */
  onSearch,
  required = false,
  id,
  name,
  ariaLabel,
  variant = 'form',
  className = '',
  style,
}) {
  const uid = useId()
  const wrapRef = useRef(null)
  const triggerRef = useRef(null)
  const panelRef = useRef(null)
  const listRef = useRef(null)
  const searchRef = useRef(null)
  const proxyRef = useRef(null)
  const typeRef = useRef({ buf: '', at: 0 })

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [pos, setPos] = useState(null)

  const hasError = invalid || error
  const list = useMemo(() => normalize(options), [options])
  const isSearchable = searchable ?? list.length > DROPDOWN_SEARCH_THRESHOLD
  const selected = useMemo(() => list.find((o) => o.value === str(value)), [list, value])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return isSearchable && q ? list.filter((o) => matches(o, q)) : list
  }, [list, query, isSearchable])

  const listId = `${uid}-list`
  const optId = (i) => `${uid}-opt-${i}`

  const openList = () => {
    if (disabled || open) return
    setQuery('')
    onSearch?.('')   // the search box was cleared: let the caller reload the unfiltered list
    const idx = list.findIndex((o) => o.value === str(value) && !o.disabled)
    setActive(idx >= 0 ? idx : firstEnabled(list))
    // Safari does not focus a button on click; keyboard control needs the focus
    triggerRef.current?.focus({ preventScroll: true })
    setOpen(true)
  }

  const closeList = useCallback((refocus = false) => {
    setOpen(false)
    setQuery('')
    if (refocus) triggerRef.current?.focus({ preventScroll: true })
  }, [])

  const choose = (opt) => {
    if (!opt || opt.disabled) return
    onChange?.(opt.value, opt)
    closeList(true)
  }

  // ── Panel position: fixed to the viewport, below the button (above when there is no room) ──
  const place = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    if (r.bottom < 0 || r.top > vh) { closeList(); return }   // the button scrolled out of view
    const gap = 4
    const margin = 8
    const below = vh - r.bottom - margin - gap
    const above = r.top - margin - gap
    const up = below < 220 && above > below
    const cap = vw <= 767 ? Math.round(vh * 0.45) : 320
    const width = Math.max(r.width, variant === 'compact' ? 170 : 0)
    const next = {
      left: Math.max(margin, Math.min(r.left, vw - width - margin)),
      width,
      maxHeight: Math.max(140, Math.min(cap, up ? above : below)),
      up,
      top: r.bottom + gap,
      bottom: vh - r.top + gap,
    }
    setPos((prev) => (samePos(prev, next) ? prev : next))
  }, [variant, closeList])

  useLayoutEffect(() => {
    if (!open) { setPos(null); return undefined }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)   // capture: also fires for scrolling parents (modals, tables)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  // Close when clicking / tapping outside the button and the panel
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target) || panelRef.current?.contains(e.target)) return
      closeList()
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open, closeList])

  // Searchable lists: focus the search box (not on touch screens, where it would raise the keyboard
  // over the list)
  const ready = open && !!pos
  useEffect(() => {
    if (!ready || !isSearchable) return
    if (window.matchMedia?.('(pointer: coarse)').matches) return
    searchRef.current?.focus({ preventScroll: true })
  }, [ready, isSearchable])

  // Keep the highlighted row visible
  useEffect(() => {
    if (!ready || active < 0) return
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active, ready])

  // `required`: the trigger is a button (barred from form validation), so a hidden input carries it
  useEffect(() => {
    proxyRef.current?.setCustomValidity(required && !str(value) ? 'Please select an option from the list.' : '')
  }, [required, value])

  const handleSearch = (e) => {
    const q = e.target.value
    setQuery(q)
    onSearch?.(q)
    const t = q.trim().toLowerCase()
    setActive(firstEnabled(t ? list.filter((o) => matches(o, t)) : list))
  }

  const typeahead = (ch) => {
    const t = typeRef.current
    const now = Date.now()
    t.buf = (now - t.at > 700 ? '' : t.buf) + ch.toLowerCase()
    t.at = now
    const i = list.findIndex((o) => !o.disabled && str(o.label).toLowerCase().startsWith(t.buf))
    if (i >= 0) setActive(i)
  }

  const handleKeyDown = (e) => {
    if (disabled) return
    const inSearch = e.target === searchRef.current
    const k = e.key

    if (!open) {
      if (inSearch) return
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
        e.preventDefault()
        openList()
      } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !isSearchable) {
        openList()
        typeahead(k)
      }
      return
    }

    if (k === 'ArrowDown') {
      e.preventDefault()
      const next = firstEnabled(filtered, active + 1, 1)
      if (next >= 0) setActive(next)
    } else if (k === 'ArrowUp') {
      e.preventDefault()
      const prev = firstEnabled(filtered, active - 1, -1)
      if (prev >= 0) setActive(prev)
    } else if (k === 'Home' && !inSearch) {
      e.preventDefault()
      setActive(firstEnabled(filtered))
    } else if (k === 'End' && !inSearch) {
      e.preventDefault()
      setActive(firstEnabled(filtered, filtered.length - 1, -1))
    } else if (k === 'Enter' || (k === ' ' && !inSearch)) {
      e.preventDefault()       // never submit the surrounding form while the list is open
      if (active >= 0) choose(filtered[active])
    } else if (k === 'Escape') {
      e.preventDefault()
      e.stopPropagation()      // do not also close the modal this dropdown sits in
      e.nativeEvent?.stopImmediatePropagation?.()
      closeList(true)
    } else if (k === 'Tab') {
      closeList()
    } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey && !inSearch && !isSearchable) {
      typeahead(k)
    }
  }

  const focusedId = open && active >= 0 ? optId(active) : undefined

  return (
    <div
      ref={wrapRef}
      className={`dd-wrap dd-wrap--${variant}${disabled ? ' is-disabled' : ''}`}
      style={style}
      onKeyDown={handleKeyDown}
      onBlur={(e) => {
        const n = e.relatedTarget
        if (open && n && !wrapRef.current?.contains(n) && !panelRef.current?.contains(n)) closeList()
      }}
    >
      <button
        ref={triggerRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={!isSearchable ? focusedId : undefined}
        aria-label={ariaLabel}
        aria-invalid={hasError || undefined}
        aria-required={required || undefined}
        disabled={disabled}
        className={`dd-trigger dd-trigger--${variant}${hasError ? ' input-error' : ''}${open ? ' is-open' : ''}${className ? ` ${className}` : ''}`}
        onClick={() => (open ? closeList() : openList())}
      >
        <span className={`dd-value${selected ? '' : ' is-placeholder'}`}>
          {loading ? 'Loading…' : selected ? (
            <>
              {selected.label}
              {selected.tag && <span className={`dd-option-tag${selected.tagTone === 'warn' ? ' warn' : ''}`}>{selected.tag}</span>}
            </>
          ) : placeholder}
        </span>
        <svg
          className="dd-chevron"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{ transform: `translateY(-50%) rotate(${open ? 180 : 0}deg)` }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {(name || required) && (
        <input
          ref={proxyRef}
          className="dd-proxy"
          tabIndex={-1}
          aria-hidden="true"
          name={name}
          value={str(value)}
          required={required}
          onChange={() => {}}
          onFocus={() => triggerRef.current?.focus()}
        />
      )}

      {ready && !disabled && createPortal(
        <div
          ref={panelRef}
          className={`dd-panel${pos.up ? ' dd-panel--up' : ''}`}
          style={{
            left: pos.left,
            width: pos.width,
            maxHeight: pos.maxHeight,
            ...(pos.up ? { bottom: pos.bottom } : { top: pos.top }),
          }}
          // keep focus where it is while clicking an option (the search box must stay clickable)
          onMouseDown={(e) => { if (e.target !== searchRef.current) e.preventDefault() }}
        >
          {isSearchable && (
            <div className="dd-search">
              <input
                ref={searchRef}
                type="text"
                className="dd-search-input"
                value={query}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                aria-controls={listId}
                aria-activedescendant={focusedId}
                autoComplete="off"
                onChange={handleSearch}
              />
            </div>
          )}
          <div ref={listRef} id={listId} role="listbox" className="dd-list">
            {loading ? (
              <div className="dd-empty">Loading…</div>
            ) : list.length === 0 ? (
              <div className="dd-empty">{noOptionsMessage || emptyMessage}</div>
            ) : filtered.length === 0 ? (
              <div className="dd-empty">{emptyMessage}</div>
            ) : (
              filtered.map((opt, idx) => {
                const isSelected = opt.value === str(value)
                const cls = [
                  'dd-option',
                  idx === active && 'is-active',
                  (isSelected || opt.highlighted) && 'is-selected',
                  opt.disabled && 'is-disabled',
                ].filter(Boolean).join(' ')
                return (
                  <div
                    key={`${opt.value}-${idx}`}
                    id={optId(idx)}
                    data-idx={idx}
                    role="option"
                    aria-selected={isSelected}
                    aria-disabled={opt.disabled || undefined}
                    className={cls}
                    onMouseEnter={() => !opt.disabled && setActive(idx)}
                    onClick={() => choose(opt)}
                  >
                    <div className="dd-option-main">
                      <div className="dd-option-name">
                        {opt.label}
                        {opt.tag && <span className={`dd-option-tag${opt.tagTone === 'warn' ? ' warn' : ''}`}>{opt.tag}</span>}
                      </div>
                      {opt.badge && <div className="dd-option-badge">{opt.badge}</div>}
                    </div>
                    {opt.sublabel && (
                      <div className={`dd-option-sub${opt.tone ? ` tone-${opt.tone}` : ''}`}>{opt.sublabel}</div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
