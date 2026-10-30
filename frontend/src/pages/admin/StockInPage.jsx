import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import StyledSelect from '../../components/StyledSelect'
import Pagination from '../../components/Pagination'
import { inventoryApi } from '../../api/inventory'
import { formatDate, isDateExpired, isDateExpiringSoon } from '../../utils/dateUtils'

const BLANK_BATCH = {
  item_id: '',
  batch_no: '',
  supplier: '',
  quantity_in: '',
  expiry_date: '',
  received_date: new Date().toISOString().split('T')[0],
  notes: '',
}

export default function StockInPage() {
  const [batches,           setBatches]           = useState([])
  const [items,             setItems]             = useState([])
  const [loading,           setLoading]           = useState(true)
  const [modal,             setModal]             = useState(false)
  const [form,              setForm]              = useState(BLANK_BATCH)
  const [saving,            setSaving]            = useState(false)
  const [filterItem,        setFilterItem]        = useState('')
  const [modalItems,        setModalItems]        = useState([])
  const [loadingModalItems, setLoadingModalItems] = useState(false)
  const [page,              setPage]              = useState(1)
  const [pageSize,          setPageSize]          = useState(10)
  const [lastPage,          setLastPage]          = useState(1)
  const [total,             setTotal]             = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const [bRes, iRes] = await Promise.all([
        inventoryApi.listBatches({ item_id: filterItem, page, per_page: pageSize }),
        inventoryApi.listItems({ status: 'active', all: true }),
      ])
      setBatches(bRes.data.batches || bRes.data.data || [])
      setLastPage(bRes.data.last_page || 1)
      setTotal(bRes.data.total ?? (bRes.data.batches || []).length)
      setItems((iRes.data.items || []).filter(i => i.category !== 'Equipment' && Boolean(i.is_active)))
    } catch {
      toast.error('Failed to load batches.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filterItem, page, pageSize])
  useEffect(() => { setPage(1) }, [filterItem])

  // Fetch active items from database API every time modal opens
  const openModal = async () => {
    setModal(true)
    setLoadingModalItems(true)
    try {
      const { data } = await inventoryApi.listItems({ status: 'active' })
      const activeItems = (data.items || []).filter(
        i => i.category !== 'Equipment' && Boolean(i.is_active)
      )
      setModalItems(activeItems)
      setForm({
        ...BLANK_BATCH,
        item_id: activeItems[0]?.id ? String(activeItems[0].id) : '',
      })
    } catch {
      toast.error('Failed to load active items.')
      setModalItems([])
    } finally {
      setLoadingModalItems(false)
    }
  }

  const closeModal = () => {
    setModal(false)
    setForm(BLANK_BATCH)
  }

  const selectedItem = modalItems.find(i => String(i.id) === String(form.item_id))
    || items.find(i => String(i.id) === String(form.item_id))
  const isMedicine = selectedItem?.category === 'Medicine'

  const handleSave = async () => {
    if (modalItems.length === 0) {
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

    setSaving(true)
    try {
      const { data } = await inventoryApi.createBatch({
        ...form,
        quantity_in: parseInt(form.quantity_in),
        item_id: parseInt(form.item_id),
      })
      setBatches(p => [data.batch, ...p])
      toast.success(data.message || 'Stock received successfully.')
      closeModal()
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to save batch.')
    } finally {
      setSaving(false)
    }
  }

  const filtered = batches.filter(b => {
    if (!filterItem) return true
    return String(b.item_id) === String(filterItem)
  }).filter(b => {
    if (!filterItem) return true
    return String(b.item_id) === String(filterItem)
  })

  const itemOptions = modalItems.map(i => ({
    value: String(i.id),
    label: i.name,
    badge: i.category,
    sublabel: `${i.current_stock ?? 0} ${i.unit}`,
  }))

  const filterOptions = [
    { value: '', label: 'All Items' },
    ...items.map(i => ({ value: String(i.id), label: i.name, badge: i.category })),
  ]

  return (
    <DashboardLayout title="Stock In" subtitle="Receive and record incoming inventory batches.">
      {/* Top Filter Bar */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ width: '240px' }}>
          <StyledSelect
            value={filterItem}
            onChange={e => setFilterItem(e.target.value)}
            options={filterOptions}
            placeholder="All Items"
          />
        </div>
        <button className="btn-primary" style={{ marginLeft: 'auto' }} onClick={openModal}>
          + Receive Stock
        </button>
      </div>

      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          No batches found. <button className="btn-primary" style={{ marginTop: '0.5rem' }} onClick={openModal}>Receive First Batch</button>
        </div>
      ) : (
        <>
          <div className="data-table-wrap" style={{ overflowX: 'auto', marginBottom: '1rem' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Batch No.</th>
                  <th>Supplier</th>
                  <th style={{ textAlign: 'center' }}>Qty In</th>
                  <th style={{ textAlign: 'center' }}>Remaining</th>
                  <th>Expiry</th>
                  <th>Received</th>
                  <th>Received By</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(b => (
                  <tr key={b.id}>
                    <td style={{ fontWeight: 600, fontSize: '0.84rem' }}>{b.item?.name || '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{b.batch_no || '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>{b.supplier || '—'}</td>
                    <td style={{ textAlign: 'center', fontSize: '0.83rem' }}>{b.quantity_in}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-badge ${b.remaining === 0 ? 'cancelled' : 'completed'}`} style={{ fontSize: '0.72rem' }}>
                        {b.remaining}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      {(() => {
                        const formatted = formatDate(b.expiry_date)
                        if (formatted === '—') return '—'

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
                    <td style={{ fontSize: '0.82rem' }}>{b.received_by?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            currentPage={page}
            totalPages={lastPage}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => { setPageSize(newSize); setPage(1) }}
          />
        </>
      )}

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
                ) : modalItems.length === 0 ? (
                  <div style={{ padding: '0.75rem 1rem', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-sm, 6px)', color: '#92400e', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span>No active items. Add or activate an item in Items first.</span>
                  </div>
                ) : (
                  <StyledSelect
                    value={form.item_id}
                    onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))}
                    options={itemOptions}
                    placeholder="— Select Item —"
                    emptyMessage="No active items. Add or activate an item in Items first."
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
                disabled={saving || modalItems.length === 0}
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
