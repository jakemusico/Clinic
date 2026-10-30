import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import StyledSelect from '../../components/StyledSelect'
import Pagination from '../../components/Pagination'
import ConfirmModal from '../../components/ConfirmModal'
import { inventoryApi } from '../../api/inventory'

const REASONS = ['Dispensed', 'Used in clinic', 'Expired', 'Damaged', 'Adjustment']

const BLANK_FORM = {
  item_id: '',
  quantity: '',
  reason: 'Used in clinic',
  notes: '',
  transaction_date: new Date().toISOString().split('T')[0],
}

const fmt = (d) => {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function StockOutPage() {
  const [items,          setItems]          = useState([])
  const [modal,          setModal]          = useState(false)
  const [form,           setForm]           = useState(BLANK_FORM)
  const [saving,         setSaving]         = useState(false)
  const [expiredBatches, setExpiredBatches] = useState([])
  const [writeOffConfirm, setWriteOffConfirm] = useState({ open: false, batch: null, loading: false })
  const [loadingItems,   setLoadingItems]   = useState(false)
  const [expPage,        setExpPage]        = useState(1)
  const expPageSize = 10
  const expTotal    = expiredBatches.length
  const expLastPage = Math.max(1, Math.ceil(expTotal / expPageSize))
  const pagedExpired = expiredBatches.slice((expPage - 1) * expPageSize, expPage * expPageSize)

  const loadData = async () => {
    try {
      const [iRes, bRes] = await Promise.all([
        inventoryApi.listItems({ status: 'active', all: true }),
        inventoryApi.listBatches({ all: true }),
      ])
      const activeNonEquip = (iRes.data.items || []).filter(
        i => i.category !== 'Equipment' && Boolean(i.is_active)
      )
      setItems(activeNonEquip)
      setExpiredBatches((bRes.data.batches || bRes.data.data || []).filter(b => b.is_expired && b.remaining > 0))
    } catch {}
  }

  useEffect(() => {
    loadData()
  }, [])

  const openModal = async () => {
    setModal('manual')
    setLoadingItems(true)
    try {
      const { data } = await inventoryApi.listItems({ status: 'active' })
      const activeNonEquip = (data.items || []).filter(
        i => i.category !== 'Equipment' && Boolean(i.is_active)
      )
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
    setSaving(true)
    try {
      const { data } = await inventoryApi.stockOut({
        ...form,
        item_id: parseInt(form.item_id),
        quantity: parseInt(form.quantity),
      })
      toast.success(data.message || 'Stock out recorded successfully.')
      closeModal()
      loadData()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to record stock out.')
    } finally {
      setSaving(false)
    }
  }

  const handleWriteOff = (batch) => {
    setWriteOffConfirm({ open: true, batch, loading: false })
  }

  const doWriteOff = async () => {
    const batch = writeOffConfirm.batch
    if (!batch) return
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
      loadData()
      setWriteOffConfirm({ open: false, batch: null, loading: false })
    } catch (e) {
      toast.error(e.response?.data?.message || 'Write-off failed.')
      setWriteOffConfirm(prev => ({ ...prev, loading: false }))
    } finally {
      setSaving(false)
    }
  }

  const itemOptions = items.map(i => ({
    value: String(i.id),
    label: i.name,
    badge: i.category,
    sublabel: `${i.current_stock ?? 0} ${i.unit} available`,
  }))

  const reasonOptions = REASONS.map(r => ({
    value: r,
    label: r,
  }))

  return (
    <DashboardLayout title="Stock Out" subtitle="Record manual outflows and write off expired batches.">
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
        <button className="btn-primary" onClick={openModal}>+ Record Stock Out</button>
      </div>

      {/* Expired Batches — Write Off */}
      {expiredBatches.length > 0 && (
        <div className="data-table-wrap" style={{ marginBottom: '1.5rem' }}>
          <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Expired Batches</span>
            <span className="status-badge cancelled" style={{ fontSize: '0.72rem' }}>{expiredBatches.length} need attention</span>
          </div>
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
                  <td style={{ fontWeight: 600, fontSize: '0.84rem' }}>{b.item?.name || '—'}</td>
                  <td style={{ fontSize: '0.82rem' }}>{b.batch_no || '—'}</td>
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
          <Pagination
            currentPage={expPage}
            totalPages={expLastPage}
            totalItems={expTotal}
            pageSize={expPageSize}
            onPageChange={setExpPage}
          />
        </div>
      )}

      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '2.5rem' }}>
        Use <strong>+ Record Stock Out</strong> to manually deduct items for internal use, damage, or adjustments.
        <br />Dispensed items are automatically deducted when saving a consultation.
      </div>

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
                  <StyledSelect
                    value={form.item_id}
                    onChange={e => setForm(p => ({ ...p, item_id: e.target.value }))}
                    options={itemOptions}
                    placeholder="— Select Item —"
                    emptyMessage="No active items available."
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
                <StyledSelect
                  value={form.reason}
                  onChange={e => setForm(p => ({ ...p, reason: e.target.value }))}
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
