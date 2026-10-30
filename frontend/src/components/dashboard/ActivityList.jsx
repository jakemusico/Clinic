import React from 'react'
import { Link } from 'react-router-dom'
import EmptyState from './EmptyState'

export default function ActivityList({
  title = "Recent Activity",
  items = [],
  viewAllLink = "/admin/audit-logs",
  loading = false,
}) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">{title}</h2>
        {viewAllLink && (
          <Link to={viewAllLink} className="dash-card-header-link">
            Audit Logs
          </Link>
        )}
      </div>

      <div className="dash-card-body-list">
        {loading ? (
          <div className="dash-loading-wrap">
            <div className="loader-ring" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            message="No recent system activities recorded."
            subtext="Audit logs will be displayed as actions are performed in the clinic system."
          />
        ) : (
          <div className="dash-activity-list">
            {items.map((log) => (
              <div key={log.id} className="dash-activity-item">
                <div className="dash-activity-bullet" />
                <div className="dash-activity-content">
                  <div className="dash-activity-line">
                    <span className="dash-activity-actor">{log.user_name}</span>
                    <span className="dash-activity-role">{log.user_role}</span>
                  </div>
                  <div className="dash-activity-desc">{log.details}</div>
                </div>
                <div className="dash-activity-time">{log.time_ago || 'Recent'}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
