import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import EmptyState from './EmptyState'

export default function AlertList({
  title = "Inventory Alerts",
  lowStockItems = [],
  expiringBatches = [],
  viewInventoryLink = "/admin/inventory",
  loading = false,
  emptyMessage = "All items and supplies are well-stocked.",
}) {
  const [activeTab, setActiveTab] = useState('all') // 'all' | 'low_stock' | 'expiring'

  const totalAlerts = lowStockItems.length + expiringBatches.length

  const filteredItems = () => {
    if (activeTab === 'low_stock') {
      return { lowStock: lowStockItems, expiring: [] }
    }
    if (activeTab === 'expiring') {
      return { lowStock: [], expiring: expiringBatches }
    }
    return { lowStock: lowStockItems, expiring: expiringBatches }
  }

  const { lowStock, expiring } = filteredItems()
  const displayCount = lowStock.length + expiring.length

  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <h2 className="dash-card-title">{title}</h2>
          {totalAlerts > 0 && (
            <span className="dash-badge-alert-count">{totalAlerts}</span>
          )}
        </div>
        {viewInventoryLink && (
          <Link to={viewInventoryLink} className="dash-card-header-link">
            Inventory
          </Link>
        )}
      </div>

      {totalAlerts > 0 && (
        <div className="dash-tab-pills" style={{ padding: '0.5rem 1.25rem 0' }}>
          <button
            type="button"
            className={`dash-tab-pill ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            All ({totalAlerts})
          </button>
          <button
            type="button"
            className={`dash-tab-pill ${activeTab === 'low_stock' ? 'active' : ''}`}
            onClick={() => setActiveTab('low_stock')}
          >
            Low Stock ({lowStockItems.length})
          </button>
          <button
            type="button"
            className={`dash-tab-pill ${activeTab === 'expiring' ? 'active' : ''}`}
            onClick={() => setActiveTab('expiring')}
          >
            Expiring ({expiringBatches.length})
          </button>
        </div>
      )}

      <div className="dash-card-body-list">
        {loading ? (
          <div className="dash-loading-wrap">
            <div className="loader-ring" />
          </div>
        ) : displayCount === 0 ? (
          <EmptyState
            message={emptyMessage}
            subtext="No items require reordering or are near expiration date."
          />
        ) : (
          <div className="dash-alert-list">
            {/* Low stock items */}
            {lowStock.map((item) => (
              <div key={`low-${item.id}`} className="dash-alert-item">
                <div className="dash-alert-indicator alert-amber" />
                <div className="dash-alert-info">
                  <div className="dash-alert-title">{item.name}</div>
                  <div className="dash-alert-meta">
                    <span className="dash-category-tag">{item.category}</span>
                    <span>Reorder at: {item.reorder_level} {item.unit}</span>
                  </div>
                </div>
                <div className="dash-alert-right">
                  <span className="dash-stock-badge low">
                    {item.current_stock} {item.unit} left
                  </span>
                </div>
              </div>
            ))}

            {/* Expiring batches */}
            {expiring.map((batch) => (
              <div key={`exp-${batch.id}`} className="dash-alert-item">
                <div className={`dash-alert-indicator ${batch.is_expired ? 'alert-red' : 'alert-amber'}`} />
                <div className="dash-alert-info">
                  <div className="dash-alert-title">
                    {batch.item_name}
                    <span className="dash-batch-no">({batch.batch_no})</span>
                  </div>
                  <div className="dash-alert-meta">
                    <span className="dash-category-tag">{batch.category || 'Batch'}</span>
                    <span>Remaining: {batch.remaining} pcs</span>
                  </div>
                </div>
                <div className="dash-alert-right">
                  <span className={`dash-stock-badge ${batch.is_expired ? 'expired' : 'expiring'}`}>
                    {batch.is_expired ? 'Expired' : `Expires ${batch.expiry_date}`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
