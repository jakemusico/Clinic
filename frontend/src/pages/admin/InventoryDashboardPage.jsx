import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import ConfirmModal from '../../components/ConfirmModal'
import { inventoryApi } from '../../api/inventory'

const Icon = ({ d, size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

const ICONS = {
  box:      'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  alert:    'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  clock:    'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
  skull:    'M12 2a9 9 0 00-9 9c0 3.18 1.65 5.98 4.13 7.62L8 22h8l.87-3.38A9 9 0 0021 11a9 9 0 00-9-9zM9 17v-1M15 17v-1M9 12a1 1 0 100-2 1 1 0 000 2zM15 12a1 1 0 100-2 1 1 0 000 2z',
  transfer: 'M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3',
  arrowUp:  'M12 19V5M5 12l7-7 7 7',
}

const fmt = (d) => {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function InventoryDashboardPage() {
  const [data,    setData]    = useState(null)
  const [loading, setLoading] = useState(true)
  const [writeOffConfirm, setWriteOffConfirm] = useState({ open: false, batch: null, loading: false })

  const load = async () => {
    setLoading(true)
    try {
      const { data: d } = await inventoryApi.dashboard()
      setData(d)
    } catch {
      toast.error('Failed to load inventory dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleWriteOff = (b) => {
    setWriteOffConfirm({ open: true, batch: b, loading: false })
  }

  const doWriteOff = async () => {
    const b = writeOffConfirm.batch
    if (!b) return
    setWriteOffConfirm(prev => ({ ...prev, loading: true }))
    try {
      await inventoryApi.stockOut({
        item_id: b.item_id,
        batch_id: b.id,
        quantity: b.remaining,
        reason: 'Expired',
        notes: `Written off expired batch #${b.batch_no || b.id}`,
      })
      toast.success('Expired batch written off.')
      load()
      setWriteOffConfirm({ open: false, batch: null, loading: false })
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to write off expired batch.')
      setWriteOffConfirm(prev => ({ ...prev, loading: false }))
    }
  }

  const stats = data ? [
    { label: 'Total Items',     value: data.stats.total_items,   icon: 'box',    cls: '' },
    { label: 'Low Stock',       value: data.stats.low_stock,     icon: 'alert',  cls: data.stats.low_stock > 0 ? 'pending' : 'completed' },
    { label: 'Expiring Soon',   value: data.stats.expiring_soon, icon: 'clock',  cls: data.stats.expiring_soon > 0 ? 'pending' : 'completed' },
    { label: 'Expired Batches', value: data.stats.expired,       icon: 'skull',  cls: data.stats.expired > 0 ? 'cancelled' : 'completed' },
  ] : []

  return (
    <DashboardLayout title="Inventory Dashboard" subtitle="Stock levels, expiry alerts, and recent activity.">
      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="stats-grid" style={{ padding: 0, marginBottom: '1.5rem' }}>
            {stats.map(s => (
              <div key={s.label} className="stat-card">
                <div className="stat-icon-badge">
                  <Icon d={ICONS[s.icon]} size={20} />
                </div>
                <div className="stat-info">
                  <span className="stat-value">{s.value}</span>
                  <span className="stat-label">
                    {s.label}
                    {s.cls && s.value > 0 && (
                      <span className={`status-badge ${s.cls}`} style={{ marginLeft: '0.4rem', fontSize: '0.68rem' }}>
                        {s.cls === 'pending' ? 'Action Needed' : 'OK'}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem', marginBottom: '1.25rem' }}>
            {/* Low Stock Items */}
            <div className="data-table-wrap">
              <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Low Stock Items</span>
                <Link to="/clinic/inventory/items" style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>View All</Link>
              </div>
              {data?.low_stock_items?.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  All items are sufficiently stocked.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Stock</th>
                      <th style={{ width: '80px', textAlign: 'center' }}>Reorder At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.low_stock_items?.map(item => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{item.name}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{item.category}</div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="status-badge cancelled">{item.current_stock} {item.unit}</span>
                        </td>
                        <td style={{ textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-sub)' }}>
                          ≤{item.reorder_level}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Expiring/Expired Batches */}
            <div className="data-table-wrap">
              <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Expiring / Expired Batches</span>
                <Link to="/clinic/inventory/stock-in" style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>Manage</Link>
              </div>
              {data?.expiry_batches?.length === 0 ? (
                <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No batches expiring within 30 days.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Item / Batch</th>
                      <th style={{ width: '95px' }}>Expiry</th>
                      <th style={{ width: '50px', textAlign: 'center' }}>Qty</th>
                      <th style={{ width: '70px', textAlign: 'center' }}>Status</th>
                      <th style={{ width: '80px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.expiry_batches?.map(b => (
                      <tr key={b.id}>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.83rem' }}>{b.item_name}</div>
                          {b.batch_no && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>#{b.batch_no}</div>}
                        </td>
                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(b.expiry_date)}</td>
                        <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>{b.remaining}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`status-badge ${b.is_expired ? 'cancelled' : 'pending'}`}>
                            {b.is_expired ? 'Expired' : 'Expiring'}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {b.is_expired ? (
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', color: '#dc2626', borderColor: '#fca5a5' }}
                              onClick={() => handleWriteOff(b)}
                            >
                              Write off
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="data-table-wrap" style={{ marginBottom: '2.5rem' }}>
            <div style={{ padding: '0.9rem 1.1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Recent Transactions</span>
              <Link to="/clinic/inventory/transactions" style={{ fontSize: '0.78rem', color: 'var(--accent)', fontWeight: 600 }}>View All</Link>
            </div>
            {data?.recent_transactions?.length === 0 ? (
              <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No transactions recorded yet.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Item</th>
                    <th style={{ width: '60px', textAlign: 'center' }}>Type</th>
                    <th style={{ width: '70px', textAlign: 'center' }}>Qty</th>
                    <th>Reason</th>
                    <th>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {data?.recent_transactions?.map(tx => (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(tx.transaction_date)}</td>
                      <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>{tx.item?.name || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`status-badge ${tx.type === 'IN' ? 'confirmed' : 'cancelled'}`}
                          style={{ fontSize: '0.72rem' }}>
                          {tx.type}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '0.82rem' }}>{tx.quantity}</td>
                      <td style={{ fontSize: '0.82rem' }}>{tx.reason}</td>
                      <td style={{ fontSize: '0.82rem' }}>{tx.recorded_by?.name || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
      {/* Write Off Expired Batch Modal */}
      <ConfirmModal
        open={writeOffConfirm.open}
        title="Write Off Expired Batch"
        message={
          writeOffConfirm.batch
            ? `Write off ${writeOffConfirm.batch.remaining} remaining units of expired batch "${writeOffConfirm.batch.batch_no || writeOffConfirm.batch.item_name}"?`
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
