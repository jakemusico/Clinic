import { EMPTY } from './emptyValue'
/**
 * Builds a Dropdown option for an inventory item:
 * name (label), category beside it (badge) and available stock on the right (sublabel).
 * Stock is only shown when the API provides it (Equipment has none).
 */
export function inventoryItemOption(item, extra = {}) {
  const stock = item.current_stock
  const hasStock = stock !== null && stock !== undefined && stock !== ''
  return {
    value: item.id === null || item.id === undefined ? '' : String(item.id),
    label: item.name,
    badge: item.category || undefined,
    sublabel: hasStock ? `${stock}${item.unit ? ` ${item.unit}` : ''}` : undefined,
    tone: hasStock && Number(stock) <= 0 ? 'out' : undefined,
    ...extra,
  }
}

/** Category filter shared by Stock In / Stock Out / Transactions (Equipment has no stock movements). */
export const INVENTORY_CATEGORY_OPTIONS = [
  { value: 'all',      label: 'All Categories' },
  { value: 'Medicine', label: 'Medicine' },
  { value: 'Supply',   label: 'Supply' },
]

/** Action button size used in the Inventory Items toolbar, so the other inventory pages match it. */
export const ACTION_BUTTON_STYLE = {
  height: '38px',
  padding: '0 1rem',
  fontSize: '0.82rem',
  fontWeight: 600,
  borderRadius: 'var(--radius-sm)',
}

export const fmtInventoryDate = (d) => {
  if (!d) return EMPTY
  const s = String(d).slice(0, 10)
  return new Date(s + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}
