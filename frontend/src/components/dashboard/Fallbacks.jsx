// Placeholders shown for a moment while a lazily loaded part of a page is being fetched.
// Skeletons (animate-pulse) instead of spinners for content areas; button-level
// spinners elsewhere are untouched.

import { CardSkeleton, CardGridSkeleton, TableSkeleton } from '../ui/Skeleton'

/** A card-shaped skeleton (calendar, tables, widgets). */
export function CardFallback({ minHeight = 240 }) {
  return (
    <CardSkeleton
      style={{ minHeight }}
    />
  )
}

/** The two equal-height chart cards. */
export function ChartsFallback() {
  return (
    <div className="dash-grid-2col">
      <CardFallback minHeight={444} />
      <CardFallback minHeight={444} />
    </div>
  )
}

/**
 * A failed load, with a Retry button. Shown instead of leaving empty cards with no explanation.
 * Reuses the existing card styles; only the red accent is new.
 */
export function LoadError({ message = 'Could not load this page.', onRetry }) {
  return (
    <div
      className="dash-card"
      role="alert"
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '1rem', flexWrap: 'wrap', padding: '0.85rem 1.25rem',
        borderLeft: '3px solid var(--red, #DC2626)',
      }}
    >
      <span style={{ fontSize: '0.88rem', color: 'var(--text)' }}>{message}</span>
      {onRetry && <button type="button" className="btn-secondary" onClick={onRetry}>Retry</button>}
    </div>
  )
}

/** Stat cards row skeleton. */
export function StatsFallback({ count = 4 }) {
  return <CardGridSkeleton count={count} />
}

/** A whole table area while its data loads. */
export function TableFallback({ rows = 8, columns = 5 }) {
  return <TableSkeleton rows={rows} columns={columns} />
}

/** A whole page while its code is loading. */
export function PageFallback() {
  return (
    <div style={{ minHeight: '40vh', padding: '1.5rem 0' }}>
      <CardGridSkeleton count={4} />
      <div style={{ marginTop: '1.5rem' }}>
        <TableSkeleton rows={8} columns={5} />
      </div>
    </div>
  )
}
