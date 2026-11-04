import Dropdown from './Dropdown'
import DateRangePicker from './DateRangePicker'
import { INVENTORY_CATEGORY_OPTIONS } from '../utils/inventoryOptions'

/**
 * The one-row filter bar shared by Stock In, Stock Out and Transactions.
 * Same markup, classes and components as the Inventory Items toolbar:
 *
 *   Search | All Categories | (extra filters) | Date range            [ actions ]
 *
 * On phones the search takes the full first row and everything else wraps below it.
 */
export default function InventoryFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  category,
  onCategoryChange,
  categoryOptions = INVENTORY_CATEGORY_OPTIONS,
  children,                    // extra filters, e.g. the IN / OUT type select on Transactions
  dateFrom,
  dateTo,
  onDateChange,
  actions,                     // the button(s) on the far right
}) {
  return (
    <div
      className="inventory-items-toolbar inventory-filterbar"
      style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <div
        className="inventory-filterbar-left"
        style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '300px' }}
      >
        {/* Search Box */}
        <div className="global-search-container" style={{ minWidth: '160px', maxWidth: '240px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            className="global-search-input"
            placeholder={searchPlaceholder}
            value={searchValue}
            onChange={e => onSearchChange(e.target.value)}
            aria-label={searchPlaceholder}
          />
        </div>

        {/* Category Filter — same Dropdown as the Items page */}
        <div className="inventory-filterbar-field" style={{ width: '165px' }}>
          <Dropdown
            variant="filter"
            ariaLabel="Category"
            value={category}
            onChange={onCategoryChange}
            options={categoryOptions}
          />
        </div>

        {children}

        <DateRangePicker from={dateFrom} to={dateTo} onChange={onDateChange} />
      </div>

      {actions && (
        <div className="inventory-filterbar-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {actions}
        </div>
      )}
    </div>
  )
}
