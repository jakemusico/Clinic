import React from 'react'
import { Link } from 'react-router-dom'

const WarningIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
)

export default function InventoryAlertBanner({ alert }) {
  if (!alert || (alert.low_stock <= 0 && alert.expiring_soon <= 0)) {
    return null
  }

  return (
    <div className="dash-alert-banner">
      <div className="dash-alert-banner-left">
        <span className="dash-alert-banner-icon">
          <WarningIcon size={18} />
        </span>
        <span className="dash-alert-banner-text">
          <strong>Inventory Alert:</strong>{' '}
          {alert.low_stock > 0 && (
            <span>
              {alert.low_stock} item{alert.low_stock > 1 ? 's' : ''} low on stock
            </span>
          )}
          {alert.low_stock > 0 && alert.expiring_soon > 0 && ' · '}
          {alert.expiring_soon > 0 && (
            <span>
              {alert.expiring_soon} batch{alert.expiring_soon > 1 ? 'es' : ''} expiring soon (30 days)
            </span>
          )}
        </span>
      </div>
      <Link to="/clinic/inventory" className="dash-alert-banner-link">
        View Inventory
      </Link>
    </div>
  )
}
