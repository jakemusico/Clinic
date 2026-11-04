import Pagination from './Pagination'

/**
 * The table region of the inventory list pages (Stock In / Stock Out / Transactions).
 * Uses the same frozen layout classes as the Inventory Items page, so the filter bar and the
 * table header stay in place and only the rows scroll:
 *
 *   <InventoryTableShell loading loaded isEmpty empty={<InventoryEmptyState .../>} pagination={{...}}>
 *     <table className="data-table">…</table>
 *   </InventoryTableShell>
 */
export function InventoryEmptyState({ title, message, hasFilters, onClearFilters, actionLabel, onAction }) {
  return (
    <div
      className="empty-state"
      style={{
        flex: 1,
        minHeight: 0,
        padding: '3.5rem 1rem',
        textAlign: 'center',
        color: 'var(--text-muted)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>{title}</div>
      <div style={{ fontSize: '0.85rem', marginBottom: '1rem', maxWidth: '460px' }}>{message}</div>
      {hasFilters ? (
        <button type="button" className="btn btn-outline" onClick={onClearFilters} style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}>
          Clear Filters
        </button>
      ) : (
        actionLabel && (
          <button type="button" className="btn-primary" onClick={onAction} style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}>
            {actionLabel}
          </button>
        )
      )}
    </div>
  )
}

export default function InventoryTableShell({ loading, loaded, isEmpty, empty, pagination, children }) {
  // First load only: afterwards the previous rows stay visible (dimmed) while new ones load,
  // so the table does not flash empty every time a filter or sort changes.
  if (!loaded) {
    return (
      <div className="table-loading" style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span className="loader-ring" />
      </div>
    )
  }

  const dim = loading ? { opacity: 0.55, pointerEvents: 'none', transition: 'opacity 0.15s ease' } : { transition: 'opacity 0.15s ease' }

  if (isEmpty) return <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, ...dim }}>{empty}</div>

  return (
    <div className="data-table-wrap inventory-table-card" style={dim} aria-busy={loading}>
      <div className="inventory-table-scroll">{children}</div>
      <Pagination {...pagination} />
    </div>
  )
}
