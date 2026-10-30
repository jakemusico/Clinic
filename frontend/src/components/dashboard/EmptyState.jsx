import React from 'react'

export default function EmptyState({ message = 'No data available', subtext, icon: IconComponent }) {
  return (
    <div className="dash-empty-state">
      {IconComponent && (
        <div className="dash-empty-icon">
          <IconComponent size={28} />
        </div>
      )}
      <p className="dash-empty-message">{message}</p>
      {subtext && <p className="dash-empty-subtext">{subtext}</p>}
    </div>
  )
}
