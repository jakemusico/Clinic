import React from 'react'

/**
 * The card used for every chart on the Nurse, Dentist and Admin dashboards, so the cards line up:
 *   - the header has one fixed height, padding, title size and subtitle size;
 *   - the subtitle is a single line (cut with "…" when it is too long);
 *   - the badge never wraps and sits at the top right (below the title on small screens);
 *   - the chart area starts at the same height in every card;
 *   - an optional `note` is small text under the chart.
 *
 * Props: title, subtitle, badge (short text, e.g. "10 visits"), note, children (the chart / loader / empty state)
 */
export default function ChartCard({ title, subtitle, badge, note, children }) {
  return (
    <div className="dash-card chart-card">
      <div className="chart-card-header">
        <div className="chart-card-heading">
          <h2 className="chart-card-title" title={title}>{title}</h2>
          {subtitle && <p className="chart-card-subtitle" title={subtitle}>{subtitle}</p>}
        </div>
        {badge && <span className="dash-badge-total-visits chart-card-badge">{badge}</span>}
      </div>

      <div className="chart-card-body">
        <div className="chart-card-plot">{children}</div>
        {/* always present, so both cards keep the same height whether or not there is a note */}
        <div className="chart-card-note">{note}</div>
      </div>
    </div>
  )
}
