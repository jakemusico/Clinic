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

/** A whole page while its code is loading. */
export function PageFallback() {
  return (
    <div className="table-loading" style={{ minHeight: '40vh' }}>
      <div className="loader-ring" />
    </div>
  )
}
