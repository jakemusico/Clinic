import React from 'react'

export default function ChartCard({ title, subtitle, headerRight, children, minHeight = 280 }) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <div>
          <h2 className="dash-card-title">{title}</h2>
          {subtitle && <p className="dash-card-subtitle">{subtitle}</p>}
        </div>
        {headerRight && <div className="dash-card-header-right">{headerRight}</div>}
      </div>
      <div className="dash-card-body" style={{ minHeight }}>
        {children}
      </div>
    </div>
  )
}
