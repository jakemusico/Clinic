import { useState } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Dropdown from '../../components/Dropdown'
import InventoryFilterBar from '../../components/InventoryFilterBar'
import InventoryTableShell, { InventoryEmptyState } from '../../components/InventoryTableShell'
import SortableTh from '../../components/SortableTh'
import useServerTable from '../../hooks/useServerTable'
import { inventoryApi } from '../../api/inventory'
import { ACTION_BUTTON_STYLE, fmtInventoryDate as fmt } from '../../utils/inventoryOptions'
import { downloadCsv } from '../../utils/csv'
import { EMPTY } from '../../utils/emptyValue'

const TYPE_OPTIONS = [
  { value: '',    label: 'IN & OUT' },
  { value: 'IN',  label: 'Stock In' },
  { value: 'OUT', label: 'Stock Out' },
]

const FILTER_DEFAULTS = { category: 'all', type: '', date_from: '', date_to: '' }

// Query shared by the table and the CSV export, so the export always matches what is on screen
const buildParams = ({ search, category, type, date_from, date_to, sort_by, sort_dir }) => ({
  search:    search || undefined,
  category:  category !== 'all' ? category : undefined,
  type:      type || undefined,
  date_from: date_from || undefined,
  date_to:   date_to || undefined,
  sort_by,
  sort_dir,
})

const fetchTransactions = async (state) => {
  const { data } = await inventoryApi.listTransactions({ ...buildParams(state), page: state.page, per_page: state.per_page })
  const rows = data.data || []
  return { rows, total: data.total ?? rows.length, lastPage: data.last_page || 1 }
}

export default function InventoryTransactionsPage() {
  const table = useServerTable({
    fetchRows: fetchTransactions,
    defaultSort: { by: 'date', dir: 'desc' },            // newest first
    filterDefaults: FILTER_DEFAULTS,
    errorMessage: 'Failed to load transactions.',
  })
  const { filters, sortBy, sortDir, handleSort } = table
  const [exporting, setExporting] = useState(false)

  // Export every row that matches the current search / filters / sort (not only the visible page)
  const handleExportCSV = async () => {
    setExporting(true)
    try {
      const { data } = await inventoryApi.listTransactions({
        ...buildParams({ search: table.search, ...filters, sort_by: sortBy, sort_dir: sortDir }),
        all: true,
      })
      const list = data.data || []
      if (list.length === 0) {
        toast.error('No transactions to export in current filtered view.')
        return
      }
      const headers = ['Date', 'Item', 'Category', 'Batch No.', 'Type', 'Quantity', 'Unit', 'Reason', 'Patient', 'Consultation', 'Recorded By', 'Notes']
      const rows = list.map(tx => [
        String(tx.transaction_date || '').slice(0, 10),
        tx.item?.name || EMPTY,
        tx.item?.category || EMPTY,
        tx.batch?.batch_no || EMPTY,
        tx.type,
        tx.quantity,
        tx.item?.unit || '',
        tx.reason,
        tx.patient_user?.name || EMPTY,
        tx.consultation_type && tx.consultation_id ? `${tx.consultation_type} #${tx.consultation_id}` : EMPTY,
        tx.recorded_by?.name || EMPTY,
        tx.notes || EMPTY,
      ])
      downloadCsv(`Inventory_Transactions_${new Date().toISOString().split('T')[0]}.csv`, headers, rows)
      toast.success(`Exported ${list.length} transaction(s) to CSV!`)
    } catch {
      toast.error('Failed to export transactions.')
    } finally {
      setExporting(false)
    }
  }

  const sortProps = { activeKey: sortBy, dir: sortDir, onSort: handleSort }

  return (
    <DashboardLayout title="Transactions" subtitle="Full history of all stock movements.">
      <div className="inventory-items-container">
        <InventoryFilterBar
          searchValue={table.searchInput}
          onSearchChange={table.setSearchInput}
          searchPlaceholder="Search item, batch no. or reason..."
          category={filters.category}
          onCategoryChange={v => table.setFilter('category', v)}
          dateFrom={filters.date_from}
          dateTo={filters.date_to}
          onDateChange={({ from, to }) => table.setFilters({ date_from: from, date_to: to })}
          actions={
            <button
              type="button"
              className="btn btn-outline"
              onClick={handleExportCSV}
              disabled={exporting}
              style={ACTION_BUTTON_STYLE}
              title="Export filtered transactions to CSV"
            >
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
          }
        >
          {/* IN & OUT type filter */}
          <div className="inventory-filterbar-field" style={{ width: '150px' }}>
            <Dropdown
              variant="filter"
              ariaLabel="Transaction type"
              value={filters.type}
              onChange={v => table.setFilter('type', v)}
              options={TYPE_OPTIONS}
            />
          </div>
        </InventoryFilterBar>

        <InventoryTableShell
          loading={table.loading}
          loaded={table.loaded}
          isEmpty={table.rows.length === 0}
          empty={
            <InventoryEmptyState
              title="No transactions found"
              message={table.hasActiveFilters
                ? 'No transactions match your active search and filter criteria.'
                : 'There are no stock movements recorded yet.'}
              hasFilters={table.hasActiveFilters}
              onClearFilters={table.resetFilters}
            />
          }
          pagination={{
            currentPage: table.page,
            totalPages: table.lastPage,
            totalItems: table.total,
            pageSize: table.pageSize,
            onPageChange: table.setPage,
            onPageSizeChange: table.setPageSize,
          }}
        >
          <table className="data-table">
            <thead>
              <tr>
                <SortableTh label="Date" sortKey="date" {...sortProps} />
                <SortableTh label="Item" sortKey="item" {...sortProps} />
                <SortableTh label="Type" sortKey="type" align="center" style={{ width: '60px' }} {...sortProps} />
                <SortableTh label="Qty" sortKey="quantity" align="center" style={{ width: '65px' }} {...sortProps} />
                <SortableTh label="Reason" sortKey="reason" {...sortProps} />
                <th>Patient</th>
                <th>Consultation</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map(tx => (
                <tr key={tx.id}>
                  <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(tx.transaction_date)}</td>
                  <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>
                    {tx.item?.name || EMPTY}
                    {tx.batch?.batch_no && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Batch #{tx.batch.batch_no}</div>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`status-badge ${tx.type === 'IN' ? 'confirmed' : 'cancelled'}`} style={{ fontSize: '0.72rem' }}>
                      {tx.type}
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontSize: '0.83rem', fontWeight: 600 }}>{tx.quantity}</td>
                  <td style={{ fontSize: '0.82rem' }}>{tx.reason}</td>
                  <td style={{ fontSize: '0.82rem' }}>{tx.patient_user?.name || EMPTY}</td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {tx.consultation_type && tx.consultation_id
                      ? <span style={{ color: 'var(--accent)' }}>{tx.consultation_type} #{tx.consultation_id}</span>
                      : EMPTY}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{tx.recorded_by?.name || EMPTY}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InventoryTableShell>
      </div>
    </DashboardLayout>
  )
}
