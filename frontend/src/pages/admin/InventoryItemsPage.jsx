import { useEffect, useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import StyledSelect from '../../components/StyledSelect'
import Pagination from '../../components/Pagination'
import { inventoryApi } from '../../api/inventory'

const BLANK_ITEM = {
  name: '',
  category: 'Medicine',
  unit: 'tablets',
  reorder_level: 10,
  is_active: true,
  equipment_status: 'Available',
  location: '',
  description: '',
}

const BLANK_STOCK_IN = {
  batch_no: '',
  supplier: '',
  quantity_in: '',
  expiry_date: '',
  received_date: new Date().toISOString().split('T')[0],
  notes: '',
}

const BLANK_STOCK_OUT = {
  quantity: '',
  reason: 'Used in clinic',
  transaction_date: new Date().toISOString().split('T')[0],
  notes: '',
}

const CATEGORY_UNITS = {
  Medicine:  ['tablets', 'capsules', 'bottles', 'vials', 'sachets', 'ampules', 'drops'],
  Supply:    ['pcs', 'boxes', 'rolls', 'pairs', 'sets', 'packs'],
  Equipment: ['piece', 'pcs', 'sets'],
}

const STOCK_OUT_REASONS = [
  'Dispensed',
  'Used in clinic',
  'Expired',
  'Damaged',
  'Adjustment',
]

const CATEGORY_FILTER_OPTIONS = [
  { value: 'all',       label: 'All Categories' },
  { value: 'Medicine',  label: 'Medicine' },
  { value: 'Supply',    label: 'Supply' },
  { value: 'Equipment', label: 'Equipment' },
]

const STATUS_FILTER_OPTIONS = [
  { value: 'all',           label: 'All Status' },
  { value: 'active',        label: 'Active' },
  { value: 'inactive',      label: 'Inactive' },
  { value: 'low_stock',     label: 'Low Stock' },
  { value: 'expiring_soon', label: 'Expiring Soon' },
  { value: 'out_of_stock',  label: 'Out of Stock' },
]

const Icon = ({ d, children, size = 18 }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.9"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d ? <path d={d} /> : children}
  </svg>
)

const ICONS = {
  box:   'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z',
  alert: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01',
  clock: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
}

const fmtDate = (d) => {
  if (!d) return '—'
  const dateObj = new Date(d + (d.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(dateObj.getTime())) return d
  return dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function InventoryItemsPage() {
  const [searchParams] = useSearchParams()
  const initialSearch = searchParams.get('search') || ''

  const [items,      setItems]      = useState([])
  const [summary,    setSummary]    = useState({ total_items: 0, low_stock: 0, expiring_soon: 0, out_of_stock: 0 })
  const [loading,    setLoading]    = useState(true)

  // Modals: null | 'new' | 'edit' | 'detail' | 'stock_in' | 'stock_out'
  const [modal,            setModal]            = useState(null)
  const [selectedItem,     setSelectedItem]     = useState(null)
  const [form,             setForm]             = useState(BLANK_ITEM)
  const [saving,           setSaving]           = useState(false)
  const [stockInForm,      setStockInForm]      = useState(BLANK_STOCK_IN)
  const [stockOutForm,     setStockOutForm]     = useState(BLANK_STOCK_OUT)

  // Detail Modal Sub-Data
  const [detailBatches,      setDetailBatches]      = useState([])
  const [detailTransactions, setDetailTransactions] = useState([])
  const [loadingDetails,     setLoadingDetails]     = useState(false)

  // Toolbar & Filtering
  const [search,     setSearch]     = useState(initialSearch)
  const [filterCat,  setFilterCat]  = useState('all')
  const [filterStat, setFilterStat] = useState('all')

  // Sorting & Pagination
  const [sortKey,  setSortKey]  = useState('name') // 'name' | 'stock' | 'nearest_expiry'
  const [sortDir,  setSortDir]  = useState('asc')  // 'asc' | 'desc'
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [lastPage, setLastPage] = useState(1)
  const [total,    setTotal]    = useState(0)

  // Sync URL search param
  useEffect(() => {
    const q = searchParams.get('search')
    if (q !== null) {
      setSearch(q)
    }
  }, [searchParams])

  // Load items & summary
  const load = async () => {
    setLoading(true)
    try {
      const { data } = await inventoryApi.listItems({
        search,
        category: filterCat,
        status: filterStat,
        page,
        per_page: pageSize,
      })
      setItems(data.items || [])
      setLastPage(data.last_page || 1)
      setTotal(data.total ?? (data.items || []).length)
      if (data.summary) {
        setSummary(data.summary)
      }
    } catch {
      toast.error('Failed to load inventory items.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [filterCat, filterStat, page, pageSize])

  // Reset page when search or filters change
  useEffect(() => {
    setPage(1)
  }, [search, filterCat, filterStat, sortKey, sortDir])

  // ── Open Modals ───────────────────────────────────────────────────────────
  const openNew = () => {
    setForm({ ...BLANK_ITEM, is_active: true })
    setSelectedItem(null)
    setModal('new')
  }

  const openEdit = (item, e) => {
    if (e) e.stopPropagation()
    setForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      reorder_level: item.reorder_level,
      is_active: Boolean(item.is_active),
      equipment_status: item.equipment_status || 'Available',
      location: item.location || '',
      description: item.description || '',
    })
    setSelectedItem(item)
    setModal('edit')
  }

  const openStockIn = (item, e) => {
    if (e) e.stopPropagation()
    setSelectedItem(item)
    setStockInForm({
      ...BLANK_STOCK_IN,
      received_date: new Date().toISOString().split('T')[0],
    })
    setModal('stock_in')
  }

  const openStockOut = (item, e) => {
    if (e) e.stopPropagation()
    setSelectedItem(item)
    setStockOutForm({
      ...BLANK_STOCK_OUT,
      transaction_date: new Date().toISOString().split('T')[0],
    })
    setModal('stock_out')
  }

  const openDetail = async (item) => {
    setSelectedItem(item)
    setModal('detail')
    setLoadingDetails(true)
    try {
      const [bRes, tRes] = await Promise.all([
        inventoryApi.listBatches({ item_id: item.id }),
        inventoryApi.listTransactions({ item_id: item.id }),
      ])
      setDetailBatches(bRes.data.batches || [])
      setDetailTransactions(tRes.data.data || tRes.data.transactions || [])
    } catch {
      toast.error('Failed to load item history details.')
    } finally {
      setLoadingDetails(false)
    }
  }

  const closeModal = () => {
    setModal(null)
    setSelectedItem(null)
    setForm(BLANK_ITEM)
    setStockInForm(BLANK_STOCK_IN)
    setStockOutForm(BLANK_STOCK_OUT)
    setDetailBatches([])
    setDetailTransactions([])
  }

  // ── Save Item (Create / Edit) ─────────────────────────────────────────────
  const handleSaveItem = async () => {
    if (!form.name.trim()) {
      toast.error('Item name is required.')
      return
    }
    setSaving(true)
    try {
      if (modal === 'new') {
        const { data } = await inventoryApi.createItem(form)
        toast.success('Item created.')
        closeModal()
        load()
      } else if (modal === 'edit' && selectedItem) {
        const { data } = await inventoryApi.updateItem(selectedItem.id, form)
        toast.success('Item updated.')
        closeModal()
        load()
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Save failed.')
    } finally {
      setSaving(false)
    }
  }

  // Deactivate/Activate from inside the Edit Modal
  const handleToggleActiveInEdit = async () => {
    if (!selectedItem) return
    const newStatus = !form.is_active
    setSaving(true)
    try {
      await inventoryApi.toggleItem(selectedItem.id)
      setForm(prev => ({ ...prev, is_active: newStatus }))
      toast.success(newStatus ? 'Item activated.' : 'Item deactivated.')
      load()
    } catch {
      toast.error('Failed to change item status.')
    } finally {
      setSaving(false)
    }
  }

  // ── Submit Stock In ───────────────────────────────────────────────────────
  const handleSubmitStockIn = async () => {
    if (!selectedItem) return
    const qty = parseInt(stockInForm.quantity_in, 10)
    if (isNaN(qty) || qty < 1) {
      toast.error('Quantity must be at least 1.')
      return
    }
    if (selectedItem.category === 'Medicine' && !stockInForm.expiry_date) {
      toast.error('Expiry date is required for medicine.')
      return
    }
    setSaving(true)
    try {
      await inventoryApi.createBatch({
        item_id: selectedItem.id,
        batch_no: stockInForm.batch_no,
        supplier: stockInForm.supplier,
        quantity_in: qty,
        expiry_date: stockInForm.expiry_date || null,
        received_date: stockInForm.received_date || new Date().toISOString().split('T')[0],
        notes: stockInForm.notes,
      })
      toast.success('Stock received successfully.')
      closeModal()
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to record stock in.')
    } finally {
      setSaving(false)
    }
  }

  // ── Submit Stock Out ──────────────────────────────────────────────────────
  const handleSubmitStockOut = async () => {
    if (!selectedItem) return
    const qty = parseInt(stockOutForm.quantity, 10)
    if (isNaN(qty) || qty < 1) {
      toast.error('Quantity must be at least 1.')
      return
    }
    const currentStock = selectedItem.current_stock ?? 0
    if (qty > currentStock) {
      toast.error(`Cannot deduct more than current stock (${currentStock} ${selectedItem.unit}).`)
      return
    }
    setSaving(true)
    try {
      await inventoryApi.stockOut({
        item_id: selectedItem.id,
        quantity: qty,
        reason: stockOutForm.reason,
        transaction_date: stockOutForm.transaction_date || new Date().toISOString().split('T')[0],
        notes: stockOutForm.notes,
      })
      toast.success('Stock deducted successfully.')
      closeModal()
      load()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Failed to record stock out.')
    } finally {
      setSaving(false)
    }
  }

  // ── Sorting & Filtering ───────────────────────────────────────────────────
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => (prev === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  const lowStockCount = useMemo(() => {
    return items.filter(
      i => i.category !== 'Equipment' && Number(i.current_stock ?? 0) > 0 && Number(i.current_stock ?? 0) <= Number(i.reorder_level ?? 0)
    ).length
  }, [items])

  const outOfStockCount = useMemo(() => {
    return items.filter(
      i => i.category !== 'Equipment' && Number(i.current_stock ?? 0) === 0
    ).length
  }, [items])

  const filtered = useMemo(() => {
    return items.filter(i => {
      // Search matching
      if (search) {
        const q = search.toLowerCase()
        const matches =
          i.name?.toLowerCase().includes(q) ||
          i.category?.toLowerCase().includes(q) ||
          i.unit?.toLowerCase().includes(q) ||
          i.location?.toLowerCase().includes(q) ||
          i.equipment_status?.toLowerCase().includes(q)
        if (!matches) return false
      }

      // Status matching
      if (filterStat === 'active') {
        if (!i.is_active) return false
      } else if (filterStat === 'inactive') {
        if (i.is_active) return false
      } else if (filterStat === 'low_stock') {
        const stock = Number(i.current_stock ?? 0)
        const reorderLevel = Number(i.reorder_level ?? 0)
        if (i.category === 'Equipment' || stock <= 0 || stock > reorderLevel) return false
      } else if (filterStat === 'expiring_soon') {
        if (!['expiring_soon', 'expired'].includes(i.expiry_status)) return false
      } else if (filterStat === 'out_of_stock') {
        const stock = Number(i.current_stock ?? 0)
        if (i.category === 'Equipment' || stock !== 0) return false
      }

      return true
    })
  }, [items, search, filterStat])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (sortKey === 'name') {
        const aVal = (a.name || '').toLowerCase()
        const bVal = (b.name || '').toLowerCase()
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      if (sortKey === 'stock') {
        const aVal = a.category === 'Equipment' ? -1 : (a.current_stock ?? 0)
        const bVal = b.category === 'Equipment' ? -1 : (b.current_stock ?? 0)
        return sortDir === 'asc' ? aVal - bVal : bVal - aVal
      }
      if (sortKey === 'nearest_expiry') {
        if (!a.nearest_expiry && !b.nearest_expiry) return 0
        if (!a.nearest_expiry) return 1
        if (!b.nearest_expiry) return -1
        return sortDir === 'asc'
          ? a.nearest_expiry.localeCompare(b.nearest_expiry)
          : b.nearest_expiry.localeCompare(a.nearest_expiry)
      }
      return 0
    })
  }, [filtered, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paginatedItems = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // ── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (sorted.length === 0) {
      toast.error('No items to export in current filtered view.')
      return
    }

    const headers = [
      'Item Name',
      'Category',
      'Unit',
      'Stock / Info',
      'Reorder Level',
      'Nearest Expiry',
      'Expiry Status',
      'Item Status',
      'Description',
    ]

    const rows = sorted.map(i => {
      const stockOrInfo =
        i.category === 'Equipment'
          ? `Condition: ${i.equipment_status || 'Available'} | Loc: ${i.location || '—'}`
          : (i.current_stock ?? 0)
      const reorder = i.category === 'Equipment' ? '—' : i.reorder_level
      const expiry = i.nearest_expiry || '—'
      const expStatus = i.expiry_status ? i.expiry_status.toUpperCase() : '—'
      const activeStatus = i.is_active ? 'Active' : 'Inactive'

      return [
        i.name,
        i.category,
        i.unit,
        stockOrInfo,
        reorder,
        expiry,
        expStatus,
        activeStatus,
        i.description || '—',
      ]
    })

    const csvContent = [
      headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
      ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n')

    const BOM = '\uFEFF'
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Inventory_Items_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast.success(`Exported ${sorted.length} item(s) to CSV!`)
  }

  const isEquip = form.category === 'Equipment'

  return (
    <DashboardLayout
      title="Inventory Items"
      subtitle="Manage medicines, supplies, and equipment stock levels and batches."
    >
      <div className="inventory-items-container">
        {/* ── Summary Cards ───────────────────────────────────────────── */}
        <div className="stats-grid inventory-items-stats">
        <div className="stat-card">
          <div className="stat-icon-badge">
            <Icon d={ICONS.box} size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{summary.total_items}</span>
            <span className="stat-label">Total Items</span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-badge">
            <Icon d={ICONS.alert} size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{lowStockCount}</span>
            <span className="stat-label">
              Low Stock
              {lowStockCount > 0 && (
                <span className="status-badge pending" style={{ marginLeft: '0.4rem', fontSize: '0.68rem' }}>
                  Action Needed
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-badge">
            <Icon d={ICONS.clock} size={20} />
          </div>
          <div className="stat-info">
            <span className="stat-value">{summary.expiring_soon}</span>
            <span className="stat-label">
              Expiring Soon
              {summary.expiring_soon > 0 && (
                <span className="status-badge pending" style={{ marginLeft: '0.4rem', fontSize: '0.68rem' }}>
                  Next 30 Days
                </span>
              )}
            </span>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon-badge">
            {/* Box-with-X icon for Out of Stock */}
            <Icon size={20}>
              <rect x="2" y="7" width="20" height="14" rx="2" strokeWidth="1.9" />
              <polyline points="16 2 12 7 8 2" strokeWidth="1.9" />
              <line x1="9" y1="12" x2="15" y2="18" strokeWidth="1.9" />
              <line x1="15" y1="12" x2="9" y2="18" strokeWidth="1.9" />
            </Icon>
          </div>
          <div className="stat-info">
            <span className="stat-value">{outOfStockCount}</span>
            <span className="stat-label">
              Out of Stock
              {outOfStockCount > 0 && (
                <span className="status-badge cancelled" style={{ marginLeft: '0.4rem', fontSize: '0.68rem' }}>
                  Restock
                </span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div
        className="inventory-items-toolbar"
        style={{
          display: 'flex',
          gap: '0.75rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', flex: 1, minWidth: '300px' }}>
          {/* Search Box */}
          <div className="global-search-container" style={{ minWidth: '160px', maxWidth: '240px' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              className="global-search-input"
              placeholder="Search items..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {/* Category Filter — same StyledSelect style as Status */}
          <div style={{ width: '165px' }}>
            <StyledSelect
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              options={CATEGORY_FILTER_OPTIONS}
            />
          </div>

          {/* Status Filter */}
          <div style={{ width: '165px' }}>
            <StyledSelect
              value={filterStat}
              onChange={e => setFilterStat(e.target.value)}
              options={STATUS_FILTER_OPTIONS}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-outline"
            onClick={handleExportCSV}
            style={{
              height: '38px',
              padding: '0 0.95rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
            }}
            title="Export filtered items to CSV"
          >
            Export CSV
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={openNew}
            style={{
              height: '38px',
              padding: '0 1rem',
              fontSize: '0.82rem',
              fontWeight: 600,
              borderRadius: 'var(--radius-sm)',
            }}
          >
            + Add Item
          </button>
        </div>
      </div>

      {/* ── Table & Content ─────────────────────────────────────────── */}
      {loading ? (
        <div className="table-loading" style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="loader-ring" />
        </div>
      ) : sorted.length === 0 ? (
        <div
          className="empty-state"
          style={{
            flex: 1,
            minHeight: 0,
            padding: '3.5rem 1rem',
            textAlign: 'center',
            color: 'var(--text-muted)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text)', marginBottom: '0.35rem' }}>
            No items found
          </div>
          <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
            {search || filterCat !== 'all' || filterStat !== 'all'
              ? 'No items match your active search and filter criteria.'
              : 'There are currently no items in the inventory database.'}
          </div>
          {(search || filterCat !== 'all' || filterStat !== 'all') ? (
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => { setSearch(''); setFilterCat('all'); setFilterStat('all') }}
              style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem' }}
            >
              Clear Filters
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              onClick={openNew}
              style={{ fontSize: '0.82rem', padding: '0.45rem 1rem' }}
            >
              Add First Item
            </button>
          )}
        </div>
      ) : (
        <div className="data-table-wrap inventory-table-card">
          <div className="inventory-table-scroll">
            <table className="data-table">
            <thead>
              <tr>
                <th
                  onClick={() => handleSort('name')}
                  style={{ cursor: 'pointer', userSelect: 'none' }}
                  title="Sort by Name"
                >
                  Name {sortKey === 'name' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th>Category</th>
                <th>Unit</th>
                <th
                  onClick={() => handleSort('stock')}
                  style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center' }}
                  title="Sort by Stock Level"
                >
                  Stock / Info {sortKey === 'stock' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ textAlign: 'center' }}>Reorder At</th>
                <th
                  onClick={() => handleSort('nearest_expiry')}
                  style={{ cursor: 'pointer', userSelect: 'none', textAlign: 'center' }}
                  title="Sort by Nearest Expiry"
                >
                  Nearest Expiry {sortKey === 'nearest_expiry' ? (sortDir === 'asc' ? '▲' : '▼') : ''}
                </th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.map(item => {
                const isEquipment = item.category === 'Equipment'
                const stock = item.current_stock ?? 0
                const isOutOfStock = !isEquipment && stock === 0
                const isLow = !isEquipment && stock > 0 && stock <= item.reorder_level

                return (
                  <tr
                    key={item.id}
                    onClick={() => openDetail(item)}
                    style={{ cursor: 'pointer' }}
                    title="Click row to view full item batches and history"
                  >
                    {/* Name & Description */}
                    <td>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem', color: 'var(--text)' }}>
                        {item.name}
                      </div>
                      {item.description && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {item.description}
                        </div>
                      )}
                    </td>

                    {/* Category */}
                    <td>
                      <span className="status-badge role-blue" style={{ fontSize: '0.72rem' }}>
                        {item.category}
                      </span>
                    </td>

                    {/* Unit */}
                    <td style={{ fontSize: '0.83rem', color: 'var(--text)' }}>
                      {item.unit}
                    </td>

                    {/* Stock / Equipment Info */}
                    <td style={{ textAlign: 'center' }}>
                      {isEquipment ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', alignItems: 'center' }}>
                          <span
                            className={`status-badge ${
                              item.equipment_status === 'Available'
                                ? 'completed'
                                : item.equipment_status === 'Retired'
                                ? 'cancelled'
                                : 'pending'
                            }`}
                            style={{ fontSize: '0.695rem', padding: '0.22rem 0.65rem', lineHeight: 1.2 }}
                          >
                            {item.equipment_status || 'Available'}
                          </span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {item.location || '—'}
                          </span>
                        </div>
                      ) : (
                        <div>
                          {isOutOfStock ? (
                            <span
                              className="status-badge"
                              style={{
                                fontSize: '0.72rem',
                                background: 'var(--red-bg)',
                                color: 'var(--red)',
                                borderColor: 'var(--red-border)',
                              }}
                            >
                              0 (Out)
                            </span>
                          ) : isLow ? (
                            <span
                              className="status-badge"
                              style={{
                                fontSize: '0.72rem',
                                background: 'rgba(249,115,22,0.1)',
                                color: '#ea580c',
                                borderColor: 'rgba(249,115,22,0.35)',
                              }}
                            >
                              {stock} (Low)
                            </span>
                          ) : (
                            <span className="status-badge completed" style={{ fontSize: '0.72rem' }}>
                              {stock}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Reorder Level */}
                    <td style={{ textAlign: 'center', fontSize: '0.83rem', color: 'var(--text-sub)' }}>
                      {isEquipment ? '—' : `≤${item.reorder_level}`}
                    </td>

                    {/* Nearest Expiry */}
                    <td style={{ textAlign: 'center' }}>
                      {item.nearest_expiry ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                            {fmtDate(item.nearest_expiry)}
                          </span>
                          {item.expiry_status === 'expired' ? (
                            <span className="status-badge cancelled" style={{ fontSize: '0.68rem' }}>
                              Expired
                            </span>
                          ) : item.expiry_status === 'expiring_soon' ? (
                            <span className="status-badge pending" style={{ fontSize: '0.68rem' }}>
                              Expiring soon
                            </span>
                          ) : (
                            <span className="status-badge completed" style={{ fontSize: '0.68rem' }}>
                              OK
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    {/* Active / Inactive Status */}
                    <td style={{ textAlign: 'center' }}>
                      <span
                        className={`status-badge ${Boolean(item.is_active) ? 'confirmed' : 'cancelled'}`}
                        style={{ fontSize: '0.72rem' }}
                      >
                        {Boolean(item.is_active) ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Row Actions: Edit, Stock In, Stock Out — always one line */}
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'inline-flex', gap: '0.3rem', justifyContent: 'center', flexWrap: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn-secondary"
                          style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                          onClick={e => openEdit(item, e)}
                        >
                          Edit
                        </button>
                        {!isEquipment && (
                          <>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                              onClick={e => openStockIn(item, e)}
                              title={`Receive new stock for ${item.name}`}
                            >
                              +In
                            </button>
                            <button
                              type="button"
                              className="btn-secondary"
                              style={{ fontSize: '0.74rem', padding: '0.2rem 0.5rem', whiteSpace: 'nowrap' }}
                              onClick={e => openStockOut(item, e)}
                              disabled={stock === 0}
                              title={stock === 0 ? 'Cannot deduct from 0 stock' : `Deduct stock for ${item.name}`}
                            >
                              −Out
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>

          {/* ── Pagination ────────────────────────────────────────────── */}
          <Pagination
            currentPage={currentPage}
            totalPages={lastPage}
            totalItems={total}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              // We're doing client-side pagination so just update page
              setPage(1)
            }}
          />
        </div>
      )}
      </div>

      {/* ── Modal: Detail View (Item Info, Batches, Transactions) ───── */}
      {modal === 'detail' && selectedItem && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal-card"
            style={{ maxWidth: '820px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h2 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  {selectedItem.name}
                  <span className="status-badge role-blue" style={{ fontSize: '0.72rem' }}>
                    {selectedItem.category}
                  </span>
                  <span
                    className={`status-badge ${Boolean(selectedItem.is_active) ? 'confirmed' : 'cancelled'}`}
                    style={{ fontSize: '0.72rem' }}
                  >
                    {Boolean(selectedItem.is_active) ? 'Active' : 'Inactive'}
                  </span>
                </h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  Unit: {selectedItem.unit} {selectedItem.description ? `· ${selectedItem.description}` : ''}
                </div>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>✕</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Item Info Summary Block */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                  gap: '0.75rem',
                  background: 'var(--bg-crust, #f8fafc)',
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                }}
              >
                {selectedItem.category === 'Equipment' ? (
                  <>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>CONDITION</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>
                        <span
                          className={`status-badge ${
                            selectedItem.equipment_status === 'Available'
                              ? 'completed'
                              : selectedItem.equipment_status === 'Retired'
                              ? 'cancelled'
                              : 'pending'
                          }`}
                          style={{ fontSize: '0.72rem' }}
                        >
                          {selectedItem.equipment_status || 'Available'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>LOCATION</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>
                        {selectedItem.location || '—'}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>CURRENT STOCK</div>
                      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)' }}>
                        {selectedItem.current_stock ?? 0} {selectedItem.unit}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>REORDER LEVEL</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>
                        ≤ {selectedItem.reorder_level} {selectedItem.unit}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>NEAREST EXPIRY</div>
                      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text)' }}>
                        {selectedItem.nearest_expiry ? fmtDate(selectedItem.nearest_expiry) : '—'}
                      </div>
                    </div>
                  </>
                )}
              </div>

              {/* Batches Table */}
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
                  Batches
                </h3>
                {loadingDetails ? (
                  <div className="table-loading" style={{ padding: '1rem' }}>
                    <span className="loader-ring" />
                  </div>
                ) : detailBatches.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    No stock batches recorded for this item.
                  </div>
                ) : (
                  <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Batch No.</th>
                          <th style={{ textAlign: 'right' }}>Remaining Qty</th>
                          <th>Expiry Date</th>
                          <th>Supplier</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailBatches.map(b => (
                          <tr key={b.id}>
                            <td style={{ fontWeight: 600, fontSize: '0.82rem' }}>
                              {b.batch_no || `#${b.id}`}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem' }}>
                              {b.remaining} {selectedItem.unit}
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>
                              {fmtDate(b.expiry_date)}
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>
                              {b.supplier || '—'}
                            </td>
                            <td>
                              {b.remaining === 0 ? (
                                <span className="status-badge cancelled" style={{ fontSize: '0.68rem' }}>Depleted</span>
                              ) : b.is_expired ? (
                                <span className="status-badge cancelled" style={{ fontSize: '0.68rem' }}>Expired</span>
                              ) : b.is_expiring_soon ? (
                                <span className="status-badge pending" style={{ fontSize: '0.68rem' }}>Expiring Soon</span>
                              ) : (
                                <span className="status-badge completed" style={{ fontSize: '0.68rem' }}>OK</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Recent Transactions Table */}
              <div>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text)' }}>
                  Recent Transactions
                </h3>
                {loadingDetails ? (
                  <div className="table-loading" style={{ padding: '1rem' }}>
                    <span className="loader-ring" />
                  </div>
                ) : detailTransactions.length === 0 ? (
                  <div style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)' }}>
                    No recent transactions recorded for this item.
                  </div>
                ) : (
                  <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Type</th>
                          <th style={{ textAlign: 'right' }}>Qty</th>
                          <th>Reason</th>
                          <th>Recorded By</th>
                          <th>Notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailTransactions.map(t => (
                          <tr key={t.id}>
                            <td style={{ fontSize: '0.82rem' }}>
                              {fmtDate(t.transaction_date || t.created_at)}
                            </td>
                            <td>
                              <span
                                className={`status-badge ${t.type === 'IN' ? 'confirmed' : 'cancelled'}`}
                                style={{ fontSize: '0.68rem', fontWeight: 700 }}
                              >
                                {t.type}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.82rem' }}>
                              {t.type === 'OUT' ? `-${t.quantity}` : `+${t.quantity}`}
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>
                              {t.reason || '—'}
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>
                              {t.recorded_by?.name || t.recordedBy?.name || 'Staff'}
                            </td>
                            <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              {t.notes || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Stock In (Item Pre-selected) ──────────────────────── */}
      {modal === 'stock_in' && selectedItem && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Stock In: {selectedItem.name}</h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Current Stock: {selectedItem.current_stock ?? 0} {selectedItem.unit}
                </div>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Quantity In * ({selectedItem.unit})</label>
                  <input
                    type="number"
                    min="1"
                    className="form-input"
                    value={stockInForm.quantity_in}
                    onChange={e => setStockInForm(p => ({ ...p, quantity_in: e.target.value }))}
                    placeholder="e.g. 50"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Batch No.</label>
                  <input
                    type="text"
                    className="form-input"
                    value={stockInForm.batch_no}
                    onChange={e => setStockInForm(p => ({ ...p, batch_no: e.target.value }))}
                    placeholder="e.g. LOT-2026-001"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">
                    Expiry Date {selectedItem.category === 'Medicine' ? '*' : '(Optional)'}
                  </label>
                  <input
                    type="date"
                    className="form-input"
                    value={stockInForm.expiry_date}
                    onChange={e => setStockInForm(p => ({ ...p, expiry_date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Received Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={stockInForm.received_date}
                    onChange={e => setStockInForm(p => ({ ...p, received_date: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Supplier / Source</label>
                <input
                  type="text"
                  className="form-input"
                  value={stockInForm.supplier}
                  onChange={e => setStockInForm(p => ({ ...p, supplier: e.target.value }))}
                  placeholder="e.g. MedSupply Co."
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={stockInForm.notes}
                  onChange={e => setStockInForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="Additional remarks"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSubmitStockIn} disabled={saving}>
                {saving ? 'Saving…' : 'Confirm Stock In'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Stock Out (Item Pre-selected) ─────────────────────── */}
      {modal === 'stock_out' && selectedItem && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" style={{ maxWidth: '500px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <h2 className="modal-title">Stock Out: {selectedItem.name}</h2>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Current Available Stock: {selectedItem.current_stock ?? 0} {selectedItem.unit}
                </div>
              </div>
              <button type="button" className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Quantity to Deduct * ({selectedItem.unit})</label>
                  <input
                    type="number"
                    min="1"
                    max={selectedItem.current_stock ?? 0}
                    className="form-input"
                    value={stockOutForm.quantity}
                    onChange={e => setStockOutForm(p => ({ ...p, quantity: e.target.value }))}
                    placeholder={`Max: ${selectedItem.current_stock ?? 0}`}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Reason *</label>
                  <select
                    className="form-input"
                    value={stockOutForm.reason}
                    onChange={e => setStockOutForm(p => ({ ...p, reason: e.target.value }))}
                  >
                    {STOCK_OUT_REASONS.map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Transaction Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={stockOutForm.transaction_date}
                  onChange={e => setStockOutForm(p => ({ ...p, transaction_date: e.target.value }))}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Notes (Optional)</label>
                <input
                  type="text"
                  className="form-input"
                  value={stockOutForm.notes}
                  onChange={e => setStockOutForm(p => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Dispensed to student / clinic usage"
                />
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSubmitStockOut} disabled={saving}>
                {saving ? 'Saving…' : 'Confirm Stock Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Add / Edit Item (with Deactivate inside) ─────────── */}
      {(modal === 'new' || modal === 'edit') && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-card" style={{ maxWidth: '520px', width: '100%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">{modal === 'new' ? 'Add Inventory Item' : 'Edit Item'}</h2>
              <button type="button" className="modal-close" onClick={closeModal}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Item Name *</label>
                <input
                  className="form-input"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Paracetamol 500mg"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    className="form-input"
                    value={form.category}
                    onChange={e => {
                      const cat = e.target.value
                      const defaultUnit = CATEGORY_UNITS[cat][0]
                      setForm(p => ({ ...p, category: cat, unit: defaultUnit }))
                    }}
                  >
                    <option value="Medicine">Medicine</option>
                    <option value="Supply">Supply</option>
                    <option value="Equipment">Equipment</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Unit *</label>
                  <select
                    className="form-input"
                    value={form.unit}
                    onChange={e => setForm(p => ({ ...p, unit: e.target.value }))}
                  >
                    {(CATEGORY_UNITS[form.category] || []).map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {!isEquip && (
                <div className="form-group">
                  <label className="form-label">Reorder Level</label>
                  <input
                    className="form-input"
                    type="number"
                    min="0"
                    value={form.reorder_level}
                    onChange={e => setForm(p => ({ ...p, reorder_level: parseInt(e.target.value, 10) || 0 }))}
                  />
                  <div className="form-hint">Warn when stock drops to or below this number.</div>
                </div>
              )}

              {isEquip && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                  <div className="form-group">
                    <label className="form-label">Equipment Status / Condition</label>
                    <select
                      className="form-input"
                      value={form.equipment_status}
                      onChange={e => setForm(p => ({ ...p, equipment_status: e.target.value }))}
                    >
                      <option value="Available">Available</option>
                      <option value="In Use">In Use</option>
                      <option value="Under Repair">Under Repair</option>
                      <option value="Retired">Retired</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Location</label>
                    <input
                      className="form-input"
                      value={form.location}
                      onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
                      placeholder="e.g. Treatment Room 1"
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  className="form-input"
                  value={form.description}
                  onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Optional notes or specifications"
                />
              </div>

              {/* Status & Deactivate / Activate button inside Edit */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.75rem 1rem',
                  background: 'var(--bg-crust, #f8fafc)',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border)',
                  marginTop: '0.25rem',
                }}
              >
                <div>
                  <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)' }}>
                    Item Availability Status
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {form.is_active ? 'Currently active and available in the clinic' : 'Inactive (archived from active selections)'}
                  </div>
                </div>
                {modal === 'edit' ? (
                  <button
                    type="button"
                    className={`btn-secondary ${form.is_active ? '' : 'success'}`}
                    style={{ fontSize: '0.78rem', padding: '0.3rem 0.75rem' }}
                    onClick={handleToggleActiveInEdit}
                  >
                    {form.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                ) : (
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', cursor: 'pointer', fontSize: '0.84rem' }}>
                    <input
                      type="checkbox"
                      checked={Boolean(form.is_active)}
                      onChange={e => setForm(p => ({ ...p, is_active: e.target.checked }))}
                    />
                    <span>Active</span>
                  </label>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={closeModal}>Cancel</button>
              <button type="button" className="btn-primary" onClick={handleSaveItem} disabled={saving}>
                {saving ? 'Saving…' : modal === 'new' ? 'Create Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
