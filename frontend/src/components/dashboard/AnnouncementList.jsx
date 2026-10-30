import React from 'react'
import { Link } from 'react-router-dom'
import EmptyState from './EmptyState'

export default function AnnouncementList({
  title = "Recent Announcements",
  items = [],
  viewAllLink = "/admin/announcements",
  loading = false,
}) {
  return (
    <div className="dash-card">
      <div className="dash-card-header">
        <h2 className="dash-card-title">{title}</h2>
        {viewAllLink && (
          <Link to={viewAllLink} className="dash-card-header-link">
            Manage
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
            message="No recent announcements posted."
            subtext="Publish clinic notices and health advisories from Announcements management."
          />
        ) : (
          <div className="dash-announcement-list">
            {items.map((ann, idx) => (
              <div key={idx} className="dash-announcement-item">
                <div className="dash-announcement-header">
                  <span className="dash-announcement-title">{ann.title}</span>
                  <span className="dash-announcement-time">{ann.time_ago || 'Recent'}</span>
                </div>
                <p className="dash-announcement-msg">{ann.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
