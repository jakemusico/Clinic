import React from 'react'
import { Link } from 'react-router-dom'
import { EMPTY } from '../../utils/emptyValue'

export default function StatCard({ value, label, icon: IconComponent, linkTo, badgeText }) {
  const content = (
    <div className="dash-stat-card">
      <div className="dash-stat-top">
        {IconComponent && (
          <div className="dash-stat-icon">
            <IconComponent size={20} />
          </div>
        )}
        {badgeText && <span className="dash-stat-badge">{badgeText}</span>}
      </div>
      <div className="dash-stat-body">
        <span className="dash-stat-value">{value ?? EMPTY}</span>
        <span className="dash-stat-label">{label}</span>
      </div>
    </div>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} style={{ textDecoration: 'none', color: 'inherit' }}>
        {content}
      </Link>
    )
  }

  return content
}
