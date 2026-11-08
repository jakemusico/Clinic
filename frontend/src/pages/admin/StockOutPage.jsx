import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Dropdown from '../../components/Dropdown'
import InventoryFilterBar from '../../components/InventoryFilterBar'
import InventoryTableShell, { InventoryEmptyState } from '../../components/InventoryTableShell'
import SortableTh from '../../components/SortableTh'
import useServerTable from '../../hooks/useServerTable'
import useSubmitLock from '../../hooks/useSubmitLock'
import Pagination from '../../components/Pagination'
import ConfirmModal from '../../components/ConfirmModal'
import { inventoryApi } from '../../api/inventory'
import { inventoryItemOption, ACTION_BUTTON_STYLE, fmtInventoryDate as fmt } from '../../utils/inventoryOptions'
import { EMPTY } from '../../utils/emptyValue'

const REASONS = ['Dispensed', 'Used in clinic', 'Expired', 'Damaged', 'Adjustment']

const BLANK_FORM = {
  item_id: '',
  quantity: '',
  reason: 'Used in clinic',
  notes: '',
  transaction_date: new Date().toISOString().split('T')[0],
}

const FILTER_DEFAULTS = { category: 'all', date_from: '', date_to: '' }

// Stock Out history = the OUT rows of the transactions endpoint (search / filters / sort / paging in the API)
const fetchStockOut = async ({ search, category, date_from, date_to, sort_by, sort_dir, page, per_page }) => {
  const { data } = await inventoryApi.listTransactions({
    type:      'OUT',
    search:    search || undefined,
    category:  category !== 'all' ? category : undefined,
    date_from: date_from || undefined,
    date_to:   date_to || undefined,
    sort_by,
    sort_dir,
    page,
    per_page,
  })
  const rows = data.data || []
  return { rows, total: data.total ?? rows.length, lastPage: data.last_page || 1 }
}

export default function StockOutPage() {
  const table = useServerTable({
    fetchRows: fetchStockOut,
    defaultSort: { by: 'date', dir: 'desc' },            // newest first
    filterDefaults: FILTER_DEFAULTS,
    errorMessage: 'Failed to load stock out records.',
  })
  const { filters, sortBy, sortDir, handleSort } = table

  const [items,           setItems]           = useState([])
  const [modal,           setModal]           = useState(false)   // false | 'manual' | 'expired'
  const [form,            setForm]            = useState(BLANK_FORM)
  const [saving,          setSaving]          = useState(false)
  // one lock for both the manual stock out and the write-off: neither can run twice or at the same time
  const { lock, unlock } = useSubmitLock()
  const [expiredBatches,  setExpiredBatches]  = useState([])
  const [writeOffConfirm, setWriteOffConfirm] = useState({ open: false, batch: null, loading: false })
  const [loadingItems,    setLoadingItems]    = useState(false)
  const [expPage,         setExpPage]         = useState(1)
  const expPageSize  = 10
  const expTotal     = expiredBatches.length
  const expLastPage  = Math.max(1, Math.ceil(expTotal / expPageSize))
  const pagedExpired = expiredBatches.slice((expPage - 1) * expPageSize, expPage * expPageSize)

  const loadExpired = async () => {
    try {
      const bRes = await inventoryApi.listBatches({ all: true })
      setExpiredBatches((bRes.data.batches || bRes.data.data || []).filter(b => b.is_expired && b.remaining > 0))
    } catch {
      // the banner simply stays hidden if this fails
    }
  }

  useEffect(() => { loadExpired() }, [])

  // Keep the expired-batches page valid when rows are written off
  useEffect(() => { if (expPage > expLastPage) setExpPage(expLastPage) }, [expPage, expLastPage])

  const openModal = async () => {
    setModal('manual')
    setLoadingItems(true)
    try {
      // Complete list (not paginated), always fresh from the database
      const { data } = await inventoryApi.itemOptions({ status: 'active' })
      const activeNonEquip = data.items || []
      setItems(activeNonEquip)
      setForm({
        ...BLANK_FORM,
        item_id: activeNonEquip[0]?.id ? String(activeNonEquip[0].id) : '',
      })
    } catch {
      toast.error('Failed to load active items.')
    } finally {
      setLoadingItems(false)
    }
  }

  const closeModal = () => {
    setModal(false)
    setForm(BLANK_FORM)
  }

  const handleSave = async () => {
    if (!form.item_id) {
      toast.error('Please select an item.')
      return
    }
    if (!form.quantity || parseInt(form.quantity) < 1) {
      toast.error('Quantity must be at least 1.')
      return
    }
    if (!lock()) return   // already saving (double click / second Enter): never take the stock out twice
    setSaving(true)
    try {
      const { data } = await inventoryApi.stockOut({
        ...form,
        item_id: parseInt(form.item_id),
        quantity: parseInt(form.quantity),
      })
      toast.success(data.message || 'Stock out recorded successfully.')
      closeModal()
      loadExpired()
      table.refreshFromStart()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to record stock out.')
    } finally {
      setSaving(false)
      unlock()
    }
  }

  const handleWriteOff = (batch) => {
    setWriteOffConfirm({ open: true, batch, loading: false })
  }

  const doWriteOff = async () => {
    const batch = writeOffConfirm.batch
    if (!batch) return
    if (!lock()) return   // a write-off (or stock out) is already running: never write the batch off twice
    setWriteOffConfirm(prev => ({ ...prev, loading: true }))
    setSaving(true)
    try {
      await inventoryApi.stockOut({
        item_id: batch.item_id,
        batch_id: batch.id,
        quantity: batch.remaining,
        reason: 'Expired',
        notes: `Write-off batch #${batch.batch_no || batch.id} — expired ${batch.expiry_date}`,
        transaction_date: new Date().toISOString().split('T')[0],
      })
      toast.success('Batch written off successfully.')
      await loadExpired()
      table.refreshFromStart()
      setWriteOffConfirm({ open: false, batch: null, loading: false })
    } catch (e) {
      toast.error(e.response?.data?.message || 'Write-off failed.')
      setWriteOffConfirm(prev => ({ ...prev, loading: false }))
    } finally {
      setSaving(false)
      unlock()
    }
  }

  // Name, category and available stock are shown in the list
  const itemOptions = items.map(i => {
    const opt = inventoryItemOption(i)
    return { ...opt, sublabel: opt.sublabel ? `${opt.sublabel} available` : undefined }
  })

  const reasonOptions = REASONS.map(r => ({
    value: r,
    label: r,
  }))

  const sortProps = { activeKey: sortBy, dir: sortDir, onSort: handleSort }

  return (
    <DashboardLayout title="Stock Out" subtitle="Record manual outflows and write off expired batches.">
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
            <button type="button" className="btn-primary" onClick={openModal} style={ACTION_BUTTON_STYLE}>
              + Record Stock Out
            </button>
          }
        />

        {/* Expired batches that still have stock: review and write them off */}
        {expiredBatches.length > 0 && (
          <div className="dash-alert-banner" style={{ flexShrink: 0, marginBottom: '0.75rem' }}>
            <div className="dash-alert-banner-left">
              <span className="dash-alert-banner-text">
                <strong>Expired Batches:</strong> {expTotal} batch{expTotal !== 1 ? 'es need' : ' needs'} attention
              </span>
            </div>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setExpPage(1); setModal('expired') }}
              style={{ ...ACTION_BUTTON_STYLE, height: '32px', fontSize: '0.78rem' }}
            >
              Review &amp; Write Off
            </button>
          </div>
        )}

        <InventoryTableShell
          loading={table.loading}
          loaded={table.loaded}
          isEmpty={table.rows.length === 0}
          empty={
            <InventoryEmptyState
              title="No stock out records found"
              message={table.hasActiveFilters
                ? 'No stock out records match your active search and filter criteria.'
                : 'Use + Record Stock Out to deduct items for internal use, damage, or adjustments. Dispensed items are deducted automatically when a consultation is saved.'}
              hasFilters={table.hasActiveFilters}
              onClearFilters={table.resetFilters}
              actionLabel="Record Stock Out"
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
                <SortableTh label="Date" sortKey="date" {...sortProps} />
                <SortableTh label="Item" sortKey="item" {...sortProps} />
                <SortableTh label="Qty" sortKey="quantity" align="center" style={{ width: '65px' }} {...sortProps} />
                <SortableTh label="Reason" sortKey="reason" {...sortProps} />
                <th>Recorded By</th>
                <th>Notes</th>
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
                  <td style={{ textAlign: 'center', fontSize: '0.83rem', fontWeight: 600 }}>
                    {tx.quantity}{tx.item?.unit ? ` ${tx.item.unit}` : ''}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>
                    {tx.reason}
                    {tx.patient_user?.name && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{tx.patient_user.name}</div>}
                  </td>
                  <td style={{ fontSize: '0.82rem' }}>{tx.recorded_by?.name || EMPTY}</td>
                  <td style={{ fontSize: '0.82rem' }}>{tx.notes || EMPTY}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </InventoryTableShell>
      </div>

      {/* Expired Batches — Write Off */}
      {modal === 'expired' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" style={{ maxWidth: '760px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                Expired Batches
                <span className="status-badge cancelled" style={{ fontSize: '0.72rem' }}>{expTotal} need attention</span>
              </h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 0 }}>
              {expTotal === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                  No expired batches left to write off.
                </div>
              ) : (
                <>
                  <div style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Batch No.</th>
                          <th>Expiry</th>
                          <th style={{ textAlign: 'center' }}>Remaining</th>
                          <th style={{ textAlign: 'center' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedExpired.map(b => (
                          <tr key={b.id}>
                            <td style={{ fontWeight: 600, fontSize: '0.84rem' }}>{b.item?.name || EMPTY}</td>
                            <td style={{ fontSize: '0.82rem' }}>{b.batch_no || EMPTY}</td>
                            <td style={{ fontSize: '0.82rem', color: '#ef4444' }}>{fmt(b.expiry_date)}</td>
                            <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>{b.remaining} {b.item?.unit || ''}</td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="btn-secondary"
                                style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem', color: '#dc2626', borderColor: '#fca5a5' }}
                                onClick={() => handleWriteOff(b)}
                                disabled={saving}
                              >
                                Write Off
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    currentPage={expPage}
                    totalPages={expLastPage}
                    totalItems={expTotal}
                    pageSize={expPageSize}
                    onPageChange={setExpPage}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {modal === 'manual' && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" style={{ maxWidth: '480px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">Record Stock Out</h2>
              <button className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Item *</label>
                {loadingItems ? (
                  <div style={{ padding: '0.65rem 0.95rem', background: 'var(--bg-crust)', border: '1.5px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Loading active items…
                  </div>
                ) : items.length === 0 ? (
                  <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm)', color: '#92400e', fontSize: '0.85rem' }}>
                    No active items. Add or activate an item in Items first.
                  </div>
                ) : (
                  <Dropdown
                    value={form.item_id}
                    onChange={v => setForm(p => ({ ...p, item_id: v }))}
                    options={itemOptions}
                    placeholder="— Select Item —"
                    noOptionsMessage="No active items available."
                  />
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Quantity *</label>
                  <input
                    className="form-input"
                    type="number"
                    min="1"
                    value={form.quantity}
                    onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    className="form-input"
                    type="date"
                    value={form.transaction_date}
                    onChange={e => setForm(p => ({ ...p, transaction_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Reason *</label>
                <Dropdown
                  value={form.reason}
                  onChange={v => setForm(p => ({ ...p, reason: v }))}
                  options={reasonOptions}
                  placeholder="Select reason"
                />
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
              <button className="btn-primary" onClick={handleSave} disabled={saving || items.length === 0}>
                {saving ? 'Saving…' : 'Record Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Write Off Batch Modal */}
      <ConfirmModal
        open={writeOffConfirm.open}
        title="Write Off Batch"
        message={
          writeOffConfirm.batch
            ? `Write off batch #${writeOffConfirm.batch.batch_no || writeOffConfirm.batch.id} with ${writeOffConfirm.batch.remaining} units remaining?`
            : ''
        }
        confirmLabel="Write Off"
        danger={true}
        loading={writeOffConfirm.loading}
        onConfirm={doWriteOff}
        onCancel={() => setWriteOffConfirm({ open: false, batch: null, loading: false })}
      />
    </DashboardLayout>
  )
}
