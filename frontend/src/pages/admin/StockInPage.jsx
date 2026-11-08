import { useState } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Dropdown from '../../components/Dropdown'
import InventoryFilterBar from '../../components/InventoryFilterBar'
import InventoryTableShell, { InventoryEmptyState } from '../../components/InventoryTableShell'
import SortableTh from '../../components/SortableTh'
import useServerTable from '../../hooks/useServerTable'
import useSubmitLock from '../../hooks/useSubmitLock'
import { inventoryApi } from '../../api/inventory'
import { inventoryItemOption, ACTION_BUTTON_STYLE } from '../../utils/inventoryOptions'
import { formatDate, isDateExpired, isDateExpiringSoon } from '../../utils/dateUtils'
import { EMPTY } from '../../utils/emptyValue'

const BLANK_BATCH = {
  item_id: '',
  batch_no: '',
  supplier: '',
  quantity_in: '',
  expiry_date: '',
  received_date: new Date().toISOString().split('T')[0],
  notes: '',
}

const FILTER_DEFAULTS = { category: 'all', date_from: '', date_to: '' }

// Search, filters, sorting and paging all run in the API (GET /inventory/batches)
const fetchBatches = async ({ search, category, date_from, date_to, sort_by, sort_dir, page, per_page }) => {
  const { data } = await inventoryApi.listBatches({
    search:        search || undefined,
    category:      category !== 'all' ? category : undefined,
    received_from: date_from || undefined,
    received_to:   date_to || undefined,
    sort_by,
    sort_dir,
    page,
    per_page,
  })
  const rows = data.batches || data.data || []
  return { rows, total: data.total ?? rows.length, lastPage: data.last_page || 1 }
}

export default function StockInPage() {
  const table = useServerTable({
    fetchRows: fetchBatches,
    defaultSort: { by: 'received', dir: 'desc' },       // newest received first
    filterDefaults: FILTER_DEFAULTS,
    errorMessage: 'Failed to load batches.',
  })
  const { filters, sortBy, sortDir, handleSort } = table

  const [items,             setItems]             = useState([])   // active stockable items for the modal
  const [modal,             setModal]             = useState(false)
  const [form,              setForm]              = useState(BLANK_BATCH)
  const [saving,            setSaving]            = useState(false)
  const { lock, unlock } = useSubmitLock()
  const [loadingModalItems, setLoadingModalItems] = useState(false)

  // Complete list (NOT paginated, includes zero-stock items). Reloaded every time the modal opens,
  // so an item created in the Items module is there immediately, with its current stock.
  const openModal = async () => {
    setModal(true)
    setLoadingModalItems(true)
    setForm(BLANK_BATCH)
    try {
      const { data } = await inventoryApi.itemOptions({ status: 'active' })
      setItems(data.items || [])
    } catch {
      toast.error('Failed to load active items.')
      setItems([])
    } finally {
      setLoadingModalItems(false)
    }
  }

  const closeModal = () => {
    setModal(false)
    setForm(BLANK_BATCH)
  }

  const selectedItem = items.find(i => String(i.id) === String(form.item_id))
  const isMedicine = selectedItem?.category === 'Medicine'

  const handleSave = async () => {
    if (items.length === 0) {
      toast.error('No active items available. Add or activate an item in Items first.')
      return
    }
    if (!form.item_id) {
      toast.error('Please select an item.')
      return
    }
    if (!form.quantity_in || parseInt(form.quantity_in) < 1) {
      toast.error('Quantity must be at least 1.')
      return
    }
    if (isMedicine && !form.expiry_date) {
      toast.error('Expiry date is required for medicines.')
      return
    }

    if (!lock()) return   // already saving (double click / second Enter): never receive the stock twice
    setSaving(true)
    try {
      const { data } = await inventoryApi.createBatch({
        ...form,
        quantity_in: parseInt(form.quantity_in),
        item_id: parseInt(form.item_id),
      })
      toast.success(data.message || 'Stock received successfully.')
      closeModal()
      table.refreshFromStart()
    } catch (e) {
      const errors = e.response?.data?.errors
      toast.error((errors && Object.values(errors)[0]?.[0]) || e.response?.data?.message || 'Failed to save batch.')
    } finally {
      setSaving(false)
      unlock()
    }
  }

  // Name, category and available stock are shown in the list
  const itemOptions = items.map(i => inventoryItemOption(i))

  const sortProps = { activeKey: sortBy, dir: sortDir, onSort: handleSort }

  return (
    <DashboardLayout title="Stock In" subtitle="Receive and record incoming inventory batches.">
      <div className="inventory-items-container">
        <InventoryFilterBar
          searchValue={table.searchInput}
          onSearchChange={table.setSearchInput}
          searchPlaceholder="Search item or batch no..."
          category={filters.category}
          onCategoryChange={v => table.setFilter('category', v)}
          dateFrom={filters.date_from}
          dateTo={filters.date_to}
          onDateChange={({ from, to }) => table.setFilters({ date_from: from, date_to: to })}
          actions={
            <button type="button" className="btn-primary" onClick={openModal} style={ACTION_BUTTON_STYLE}>
              + Receive Stock
            </button>
          }
        />

        <InventoryTableShell
          loading={table.loading}
          loaded={table.loaded}
          isEmpty={table.rows.length === 0}
          empty={
            <InventoryEmptyState
              title="No batches found"
              message={table.hasActiveFilters
                ? 'No batches match your active search and filter criteria.'
                : 'No stock has been received yet.'}
              hasFilters={table.hasActiveFilters}
              onClearFilters={table.resetFilters}
              actionLabel="Receive First Batch"
              onAction={openModal}
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
                <SortableTh label="Item" sortKey="item" {...sortProps} />
                <th>Batch No.</th>
                <th>Supplier</th>
                <SortableTh label="Qty In" sortKey="quantity_in" align="center" {...sortProps} />
                <SortableTh label="Remaining" sortKey="remaining" align="center" {...sortProps} />
                <SortableTh label="Expiry" sortKey="expiry" {...sortProps} />
                <SortableTh label="Received" sortKey="received" {...sortProps} />
                <th>Received By</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.map(b => (
                <tr key={b.id}>
                  <td style={{ fontWeight: 600, fontSize: '0.84rem' }}>{b.item?.name || EMPTY}</td>
                  <td style={{ fontSize: '0.82rem' }}>{b.batch_no || EMPTY}</td>
                  <td style={{ fontSize: '0.82rem' }}>{b.supplier || EMPTY}</td>
                  <td style={{ textAlign: 'center', fontSize: '0.83rem' }}>{b.quantity_in}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className={`status-badge ${b.remaining === 0 ? 'cancelled' : 'completed'}`} style={{ fontSize: '0.72rem' }}>
                      {b.remaining}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                    {(() => {
                      const formatted = formatDate(b.expiry_date)
                      if (formatted === EMPTY) return EMPTY

                      const expired = Boolean(b.is_expired ?? isDateExpired(b.expiry_date))
                      const expiringSoon = !expired && Boolean(b.is_expiring_soon ?? isDateExpiringSoon(b.expiry_date))

                      return (
                        <span
                          style={{
                            color: expired ? 'var(--danger, #ef4444)' : expiringSoon ? '#d97706' : 'inherit',
                            fontWeight: expired || expiringSoon ? 600 : 'normal',
                          }}
                        >
                          {formatted}
                          {expired && ' (Expired)'}
                          {expiringSoon && ' (Soon)'}
                        </span>
                      )
                    })()}
                  </td>
                  <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{formatDate(b.received_date)}</td>
                  <td style={{ fontSize: '0.82rem' }}>{b.received_by?.name || EMPTY}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InventoryTableShell>
      </div>

      {/* Receive Stock Modal */}
      {modal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" style={{ maxWidth: '520px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Receive Stock</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Item *</label>
                {loadingModalItems ? (
                  <div style={{ padding: '0.65rem 0.95rem', background: 'var(--bg-crust, #f8fafc)', border: '1.5px solid var(--border, #cbd5e1)', borderRadius: 'var(--radius-sm, 6px)', fontSize: '0.85rem', color: 'var(--text-muted, #64748b)' }}>
                    Loading active items…
                  </div>
                ) : items.length === 0 ? (
                  <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm, 6px)', color: '#92400e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>No active items. Add or activate an item in Items first.</span>
                  </div>
                ) : (
                  <Dropdown
                    value={form.item_id}
                    onChange={v => setForm(p => ({ ...p, item_id: v }))}
                    options={itemOptions}
                    placeholder="— Select Item —"
                    noOptionsMessage="No active items. Add or activate an item in Items first."
                  />
                )}
                {!loadingModalItems && items.length > 0 && (
                  <div className="form-hint">{items.length} active item{items.length !== 1 ? 's' : ''} · type to search by name or category</div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={form.quantity_in}
                    onChange={e => setForm(p => ({ ...p, quantity_in: e.target.value }))}
                    placeholder="e.g. 100"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Batch No.</label>
                  <input
                    className="form-input"
                    value={form.batch_no}
                    onChange={e => setForm(p => ({ ...p, batch_no: e.target.value }))}
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Supplier</label>
                <input
                  className="form-input"
                  value={form.supplier}
                  onChange={e => setForm(p => ({ ...p, supplier: e.target.value }))}
                  placeholder="Optional"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    Expiry Date {isMedicine && <span style={{ color: 'var(--danger, #ef4444)' }}>*</span>}
                  </label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.expiry_date}
                    onChange={e => setForm(p => ({ ...p, expiry_date: e.target.value }))}
                  />
                  {isMedicine && <div className="form-hint">Required for medicine.</div>}
                </div>
                <div className="form-group">
                  <label className="form-label">Received Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.received_date}
                    onChange={e => setForm(p => ({ ...p, received_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <input
                  className="form-input"
                  value={form.notes}
                  onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving || items.length === 0}
              >
                {saving ? 'Saving…' : 'Receive Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
