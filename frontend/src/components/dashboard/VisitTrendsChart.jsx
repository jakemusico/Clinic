import React from 'react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'
import EmptyState from './EmptyState'

export default function VisitTrendsChart({ data = [], loading = false, period = 'monthly' }) {
  const totalVisits = data.reduce((sum, d) => sum + (d.visits || 0), 0)

  return (
    <div className="dash-card" style={{ height: '100%' }}>
      <div className="dash-card-header">
        <div>
          <h2 className="dash-card-title">Clinic Visit Trends</h2>
          <p className="dash-card-subtitle">
            {period === 'daily'
              ? 'Daily consultations throughout the month'
              : period === 'monthly'
              ? 'Monthly consultations across the year'
              : 'Yearly consultations over the last 5 years'}
          </p>
        </div>
        <span className="dash-badge-total-visits">
          {totalVisits} Total Visit{totalVisits === 1 ? '' : 's'}
        </span>
      </div>

      <div className="dash-card-body" style={{ minHeight: 280, justifyContent: 'center' }}>
        {loading ? (
          <div className="dash-loading-wrap">
            <div className="loader-ring" />
          </div>
        ) : data.length === 0 || totalVisits === 0 ? (
          <EmptyState
            message="No consultation visits recorded in this period."
            subtext="Visits will populate automatically as consultations are logged."
          />
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 15, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="short_label"
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={11}
                  tickLine={false}
                  allowDecimals={false}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0].payload
                      return (
                        <div
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: 6,
                            padding: '8px 12px',
                            fontSize: '0.8rem',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#0F172A', marginBottom: 4 }}>
                            {item.label}
                          </div>
                          <div style={{ color: '#2563EB', fontWeight: 700 }}>
                            {item.visits} Consultation{item.visits === 1 ? '' : 's'}
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="visits"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  dot={{ r: 3.5, fill: '#2563EB', stroke: '#FFFFFF', strokeWidth: 1.5 }}
                  activeDot={{ r: 5.5, fill: '#1D4ED8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
