/**
 * Clickable table header with the ▲/▼ indicator — same markup and behaviour as the
 * sortable headers on the Inventory Items page, plus keyboard support.
 *
 *   <SortableTh label="Date" sortKey="date" activeKey={sortBy} dir={sortDir} onSort={handleSort} />
 */
export default function SortableTh({ label, sortKey, activeKey, dir, onSort, align, style, title }) {
  const active = activeKey === sortKey
  return (
    <th
      onClick={() => onSort(sortKey)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort(sortKey) } }}
      tabIndex={0}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
      style={{ cursor: 'pointer', userSelect: 'none', textAlign: align, ...style }}
      title={title || `Sort by ${label}`}
    >
      {label} {active ? (dir === 'asc' ? '▲' : '▼') : ''}
    </th>
  )
}
