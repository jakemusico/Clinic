import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * Compact date range control: ONE button that shows the range ("Oct 1 - Oct 31, 2026")
 * and opens a small two-click calendar (click the first day, then the last day).
 * A clear (✕) button resets it. Same look as the other filter inputs (40px, 1.5px border).
 *
 *   <DateRangePicker from="2026-10-01" to="2026-10-31" onChange={({ from, to }) => ...} />
 *
 * Values are 'YYYY-MM-DD' strings (or ''), which is what the API expects.
 * Keyboard: arrows move by day/week, PageUp/PageDown by month, Enter/Space picks, Esc closes.
 */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT = MONTHS.map(m => m.slice(0, 3))
const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const pad = (n) => String(n).padStart(2, '0')
const toKey = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`          // m is 0-based
const parse = (s) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '')
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null
}
const todayKey = () => { const t = new Date(); return toKey(t.getFullYear(), t.getMonth(), t.getDate()) }
const addDays = (key, n) => { const p = parse(key); const d = new Date(p.y, p.m, p.d + n); return toKey(d.getFullYear(), d.getMonth(), d.getDate()) }
const addMonths = (key, n) => {
  const p = parse(key); const d = new Date(p.y, p.m + n, 1)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  return toKey(d.getFullYear(), d.getMonth(), Math.min(p.d, last))
}
const fmt = (key, withYear) => { const p = parse(key); return `${SHORT[p.m]} ${p.d}${withYear ? `, ${p.y}` : ''}` }

function formatRange(from, to) {
  const a = parse(from), b = parse(to)
  if (a && b) {
    if (from === to) return fmt(from, true)
    if (a.y === b.y) return `${fmt(from, false)} - ${fmt(to, true)}`
    return `${fmt(from, true)} - ${fmt(to, true)}`
  }
  if (a) return `From ${fmt(from, true)}`
  if (b) return `Until ${fmt(to, true)}`
  return ''
}

export default function DateRangePicker({ from = '', to = '', onChange, placeholder = 'Date range', disabled = false, style, ariaLabel = 'Date range' }) {
  const wrapRef = useRef(null)
  const panelRef = useRef(null)
  const triggerRef = useRef(null)

  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState(null)         // first click of a new range
  const [hover, setHover] = useState(null)
  const [cursor, setCursor] = useState(todayKey())   // the day that has keyboard focus (also decides the month shown)
  const [alignRight, setAlignRight] = useState(false)
  const focusDay = useRef(false)                      // move DOM focus to the day only when the grid drives the change

  const hasValue = Boolean(from || to)
  const label = formatRange(from, to)

  const openPanel = () => {
    if (disabled) return
    setAnchor(null); setHover(null)
    setCursor(parse(from) ? from : parse(to) ? to : todayKey())
    const r = wrapRef.current?.getBoundingClientRect()
    if (r) setAlignRight(r.left + 320 > window.innerWidth - 8 && r.right - 320 > 8)
    focusDay.current = true
    setOpen(true)
  }

  const close = (restoreFocus = true) => {
    setOpen(false); setAnchor(null); setHover(null)
    if (restoreFocus) triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) close(false) }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  // Put focus on the focused day when the panel opens or the arrow keys move it
  useEffect(() => {
    if (!open || !focusDay.current) return
    focusDay.current = false
    panelRef.current?.querySelector(`[data-date="${cursor}"]`)?.focus()
  }, [open, cursor])

  const view = parse(cursor)
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1).getDay()
    const days = new Date(view.y, view.m + 1, 0).getDate()
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => toKey(view.y, view.m, i + 1))]
  }, [view.y, view.m])

  const pick = (key) => {
    if (!anchor) { setAnchor(key); setCursor(key); return }
    const [a, b] = anchor <= key ? [anchor, key] : [key, anchor]
    onChange?.({ from: a, to: b })
    close()
  }

  // Range to paint: the pending selection while choosing, otherwise the applied one
  const previewEnd = anchor ? (hover || anchor) : null
  const rs = anchor ? (anchor <= previewEnd ? anchor : previewEnd) : from
  const re = anchor ? (anchor <= previewEnd ? previewEnd : anchor) : to

  const onGridKey = (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]
    let next = null
    if (step) next = addDays(cursor, step)
    else if (e.key === 'PageUp') next = addMonths(cursor, -1)
    else if (e.key === 'PageDown') next = addMonths(cursor, 1)
    else if (e.key === 'Home') next = toKey(view.y, view.m, 1)
    else if (e.key === 'End') next = toKey(view.y, view.m, new Date(view.y, view.m + 1, 0).getDate())
    if (next) { e.preventDefault(); focusDay.current = true; setCursor(next) }
  }

  const today = todayKey()

  return (
    <div
      ref={wrapRef}
      className={`drp-wrap${open ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}
      style={style}
      onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); close() } }}
    >
      <div className="drp-field">
        <button
          ref={triggerRef}
          type="button"
          className="drp-trigger"
          onClick={() => (open ? close(false) : openPanel())}
          disabled={disabled}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={hasValue ? `${ariaLabel}: ${label}` : ariaLabel}
          title={hasValue ? label : undefined}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <span className={`drp-label${hasValue ? '' : ' is-placeholder'}`}>{hasValue ? label : placeholder}</span>
        </button>
        {hasValue && !disabled && (
          <button type="button" className="drp-clear" aria-label="Clear date range" title="Clear date range" onClick={() => { onChange?.({ from: '', to: '' }); close(false) }}>
            ✕
          </button>
        )}
      </div>

      {open && (
        <div ref={panelRef} className={`drp-panel${alignRight ? ' drp-panel--right' : ''}`} role="dialog" aria-label="Choose date range">
          <div className="drp-head">
            <button type="button" className="drp-nav" aria-label="Previous year" onClick={() => setCursor(addMonths(cursor, -12))}>«</button>
            <button type="button" className="drp-nav" aria-label="Previous month" onClick={() => setCursor(addMonths(cursor, -1))}>‹</button>
            <div className="drp-title" aria-live="polite">{MONTHS[view.m]} {view.y}</div>
            <button type="button" className="drp-nav" aria-label="Next month" onClick={() => setCursor(addMonths(cursor, 1))}>›</button>
            <button type="button" className="drp-nav" aria-label="Next year" onClick={() => setCursor(addMonths(cursor, 12))}>»</button>
          </div>

          <div className="drp-weekdays" aria-hidden="true">{WEEKDAYS.map(w => <span key={w}>{w}</span>)}</div>

          <div className="drp-grid" onKeyDown={onGridKey} onMouseLeave={() => setHover(null)}>
            {cells.map((key, i) => {
              if (!key) return <span key={`b${i}`} />
              const isStart = key === rs, isEnd = key === re
              const inRange = rs && re && key > rs && key < re
              const cls = ['drp-day', (isStart || isEnd) && 'is-edge', inRange && 'is-range', key === today && 'is-today'].filter(Boolean).join(' ')
              return (
                <button
                  key={key}
                  type="button"
                  data-date={key}
                  className={cls}
                  tabIndex={key === cursor ? 0 : -1}
                  aria-label={fmt(key, true)}
                  aria-pressed={isStart || isEnd}
                  onClick={() => pick(key)}
                  onMouseEnter={() => anchor && setHover(key)}
                >
                  {parse(key).d}
                </button>
              )
            })}
          </div>

          <div className="drp-foot">
            <span className="drp-hint">{anchor ? 'Now pick the last day' : 'Pick the first day'}</span>
            {hasValue && (
              <button type="button" className="drp-link" onClick={() => { onChange?.({ from: '', to: '' }); close() }}>Clear</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
