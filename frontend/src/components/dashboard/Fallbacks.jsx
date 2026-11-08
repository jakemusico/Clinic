// Placeholders shown for a moment while a lazily loaded part of a page is being fetched.
// They reuse the existing card and spinner styles, so nothing new is introduced visually.

/** A card with the standard spinner (calendar, tables). */
export function CardFallback({ minHeight = 240 }) {
  return (
    <div className="dash-card" style={{ minHeight, width: '100%' }}>
      <div className="dash-loading-wrap">
        <div className="loader-ring" />
      </div>
    </div>
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

/** A whole page while its code is loading. */
export function PageFallback() {
  return (
    <div className="table-loading" style={{ minHeight: '40vh' }}>
      <div className="loader-ring" />
    </div>
  )
}
