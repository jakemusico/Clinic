import { useEffect, useState } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import Pagination from '../../components/Pagination'
import StyledSelect, { DateInput } from '../../components/StyledSelect'
import { inventoryApi } from '../../api/inventory'

const fmt = (d) => {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function InventoryTransactionsPage() {
  const [transactions, setTransactions] = useState([])
  const [items,        setItems]        = useState([])
  const [loading,      setLoading]      = useState(true)
  const [filterItem,   setFilterItem]   = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [dateFrom,     setDateFrom]     = useState('')
  const [dateTo,       setDateTo]       = useState('')
  const [page,         setPage]         = useState(1)
  const [pageSize,     setPageSize]     = useState(10)
  const [lastPage,     setLastPage]     = useState(1)
  const [total,        setTotal]        = useState(0)

  const load = async () => {
    setLoading(true)
    try {
      const params = { page, per_page: pageSize, item_id: filterItem, type: filterType, date_from: dateFrom, date_to: dateTo }
      const { data } = await inventoryApi.listTransactions(params)
      setTransactions(data.data || [])
      setLastPage(data.last_page || 1)
      setTotal(data.total || 0)
    } catch {
      toast.error('Failed to load transactions.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page, pageSize, filterItem, filterType, dateFrom, dateTo])

  useEffect(() => {
    inventoryApi.listItems()
      .then(({ data }) => setItems(data.items || []))
      .catch(() => {})
  }, [])

  const resetFilters = () => {
    setFilterItem('')
    setFilterType('')
    setDateFrom('')
    setDateTo('')
    setPage(1)
  }

  return (
    <DashboardLayout title="Transactions" subtitle="Full history of all stock movements.">
      {/* Filters */}
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1rem', alignItems: 'center' }}>
        <div style={{ minWidth: '190px' }}>
          <StyledSelect
            value={filterItem}
            onChange={e => { setFilterItem(e.target.value); setPage(1) }}
          >
            <option value="">All Items</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          </StyledSelect>
        </div>

        <div style={{ minWidth: '135px' }}>
          <StyledSelect
            value={filterType}
            onChange={e => { setFilterType(e.target.value); setPage(1) }}
          >
            <option value="">IN & OUT</option>
            <option value="IN">Stock In</option>
            <option value="OUT">Stock Out</option>
          </StyledSelect>
        </div>

        <DateInput
          label="From"
          value={dateFrom}
          onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          max={dateTo || undefined}
        />

        <DateInput
          label="To"
          value={dateTo}
          onChange={e => { setDateTo(e.target.value); setPage(1) }}
          min={dateFrom || undefined}
        />

        {(filterItem || filterType || dateFrom || dateTo) && (
          <button
            className="btn-ghost"
            onClick={resetFilters}
            style={{
              height: '40px',
              padding: '0 0.85rem',
              fontSize: '0.82rem',
              borderRadius: 'var(--radius-sm, 6px)',
              border: '1px solid var(--border, #cbd5e1)',
              display: 'inline-flex',
              alignItems: 'center',
            }}
          >
            Clear
          </button>
        )}
        <span style={{ marginLeft: 'auto', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
          {total} transaction{total !== 1 ? 's' : ''}
        </span>
      </div>

      {loading ? (
        <div className="table-loading"><span className="loader-ring" /></div>
      ) : transactions.length === 0 ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>No transactions found.</div>
      ) : (
        <>
          <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Item</th>
                  <th style={{ textAlign: 'center', width: '60px' }}>Type</th>
                  <th style={{ textAlign: 'center', width: '65px' }}>Qty</th>
                  <th>Reason</th>
                  <th>Patient</th>
                  <th>Consultation</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(tx.transaction_date)}</td>
                    <td style={{ fontWeight: 600, fontSize: '0.83rem' }}>
                      {tx.item?.name || '—'}
                      {tx.batch?.batch_no && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Batch #{tx.batch.batch_no}</div>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`status-badge ${tx.type === 'IN' ? 'confirmed' : 'cancelled'}`} style={{ fontSize: '0.72rem' }}>
                        {tx.type}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: '0.83rem', fontWeight: 600 }}>{tx.quantity}</td>
                    <td style={{ fontSize: '0.82rem' }}>{tx.reason}</td>
                    <td style={{ fontSize: '0.82rem' }}>{tx.patient_user?.name || '—'}</td>
                    <td style={{ fontSize: '0.82rem' }}>
                      {tx.consultation_type && tx.consultation_id
                        ? <span style={{ color: 'var(--accent)' }}>{tx.consultation_type} #{tx.consultation_id}</span>
                        : '—'}
                    </td>
                    <td style={{ fontSize: '0.82rem' }}>{tx.recorded_by?.name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
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
    </DashboardLayout>
  )
}
