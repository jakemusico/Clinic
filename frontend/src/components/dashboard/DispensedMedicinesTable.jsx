import React from 'react'
import { Link } from 'react-router-dom'
import EmptyState from './EmptyState'

export default function DispensedMedicinesTable({
  title = "Recently Dispensed Medicines",
  items = [],
  viewAllLink = "/admin/inventory/transactions",
  loading = false,
}) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">{title}</h2>
        {viewAllLink && (
          <Link to={viewAllLink} className="dash-card-header-link">
            Transactions
          </Link>
        )}
      </div>

      <div className="dash-card-body-table">
        {loading ? (
          <div className="dash-loading-wrap">
            <div className="loader-ring" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            message="No dispensed medicines recorded recently."
            subtext="Medications issued to patients during consultations will appear here."
          />
        ) : (
          <div className="table-responsive">
            <table className="dash-table">
              <thead>
                <tr>
                  <th style={{ width: '105px' }}>Date</th>
                  <th>Medicine / Item</th>
                  <th style={{ width: '90px' }}>Quantity</th>
                  <th>Patient / Recipient</th>
                  <th>Purpose / Reason</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={row.id}>
                    <td className="dash-td-date">
                      <span className="dash-date-text">{row.transaction_date || '—'}</span>
                    </td>
                    <td>
                      <div className="dash-item-name">{row.item_name}</div>
                      <div className="dash-item-category">{row.category}</div>
                    </td>
                    <td>
                      <span className="dash-qty-badge">
                        {row.quantity} {row.unit}
                      </span>
                    </td>
                    <td>
                      <div className="dash-recipient-name">{row.patient_name || 'Clinic Patient'}</div>
                    </td>
                    <td className="dash-td-reason">
                      {row.reason || 'Dispensed for consultation'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
