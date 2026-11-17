/**
 * Lightweight CSS-only skeleton loaders. The project has no Tailwind, so the
 * pulse animation and neutral fill live in `.sk-pulse` (index.css); dimensions
 * are inline styles so every block renders correctly regardless of utility CSS.
 *
 *   <Skeleton className="sk-line" style={{ width: 120, height: 14 }} />
 *   <TableSkeleton rows={8} columns={5} />   — table-shaped placeholder
 *   <CardSkeleton lines={3} />               — dashboard/stat card placeholder
 *   <CardGridSkeleton count={4} />           — row of stat cards
 */

export function Skeleton({ className = '', style }) {
  return <div className={`sk-pulse ${className}`} style={style} aria-hidden="true" />
}

const sk = (w, h, extra = {}) => ({ width: w, height: h, ...extra })

/** One table row of skeleton cells; col 0 gets avatar+text, last col a badge pill. */
function TableRowSkeleton({ columns }) {
  return (
    <tr>
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} style={{ padding: '0.85rem 1rem' }}>
          {i === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Skeleton style={sk(32, 32, { borderRadius: '50%' })} />
              <Skeleton style={sk(112, 14)} />
            </div>
          ) : i === columns - 1 ? (
            <Skeleton style={{ ...sk(64, 24, { borderRadius: 999, marginLeft: 'auto' }) }} />
          ) : (
            <Skeleton style={sk('100%', 14, { maxWidth: 110 })} />
          )}
        </td>
      ))}
    </tr>
  )
}

/**
 * Table-shaped skeleton matching .data-table cell padding. Drop it where the
 * old `<div className="table-loading"><span className="loader-ring"/></div>`
 * used to sit — it occupies roughly the same vertical space, so no layout jump.
 */
export function TableSkeleton({ rows = 8, columns = 5, className = '' }) {
  return (
    <div className={`data-table-wrap ${className}`} role="status" aria-label="Loading">
      <table className="data-table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, i) => (
              <th key={i}>
                <Skeleton style={sk(80, 12)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <TableRowSkeleton key={r} columns={columns} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Dashboard summary card / detail panel placeholder. */
export function CardSkeleton({ lines = 3, className = '', style }) {
  return (
    <div
      className={`dash-card ${className}`}
      style={{ width: '100%', padding: '1.25rem', ...style }}
      role="status"
      aria-label="Loading"
    >
      <Skeleton style={{ ...sk(96, 14), marginBottom: 12 }} />
      <Skeleton style={{ ...sk(64, 28), marginBottom: 16 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} style={{ ...sk('100%', 12), marginBottom: 8, opacity: 1 - i * 0.18 }} />
      ))}
    </div>
  )
}

/** Row of stat cards, matching the dashboard stats grid. */
export function CardGridSkeleton({ count = 4 }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: '1rem',
        width: '100%',
      }}
      role="status"
      aria-label="Loading"
    >
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} lines={1} />
      ))}
    </div>
  )
}

/** Chart-area placeholder (visit trends, symptom charts). */
export function ChartSkeleton({ height = 220 }) {
  return (
    <div style={{ width: '100%', height }} role="status" aria-label="Loading">
      <Skeleton style={{ width: '100%', height: '100%', borderRadius: 8 }} />
    </div>
  )
}

/** A few list rows for dashboard activity/alert/announcement lists. */
export function ListSkeleton({ rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', padding: '0.5rem 0' }} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Skeleton style={sk(32, 32, { borderRadius: '50%', flexShrink: 0 })} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <Skeleton style={{ ...sk('70%', 13), marginBottom: 6 }} />
            <Skeleton style={sk('45%', 11)} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default Skeleton
