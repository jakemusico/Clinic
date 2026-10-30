import React from 'react'
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  Legend,
} from 'recharts'
import EmptyState from './EmptyState'

// Curated primary healthcare blue palette and tints
const BLUE_TINTS = [
  '#2563EB', // Primary Blue
  '#3B82F6', // Blue 500
  '#60A5FA', // Blue 400
  '#93C5FD', // Blue 300
  '#1D4ED8', // Blue 700
  '#CBD5E1', // Neutral Slate for "Others"
]

export default function FrequentSymptomsChart({ data = [], loading = false }) {
  const totalCount = data.reduce((sum, d) => sum + (d.count || 0), 0)

  return (
    <div className="dash-card" style={{ height: '100%' }}>
      <div className="dash-card-header">
        <div>
          <h2 className="dash-card-title">Frequent Symptoms</h2>
          <p className="dash-card-subtitle">
            Top 5 complaint/diagnosis categories from consultation records
          </p>
        </div>
        {totalCount > 0 && (
          <span className="dash-badge-total-visits">
            {totalCount} Total Log{totalCount === 1 ? '' : 's'}
          </span>
        )}
      </div>

      <div className="dash-card-body" style={{ minHeight: 280, justifyContent: 'center' }}>
        {loading ? (
          <div className="dash-loading-wrap">
            <div className="loader-ring" />
          </div>
        ) : data.length === 0 || totalCount === 0 ? (
          <EmptyState
            message="No symptoms or consultation diagnoses found."
            subtext="Category distributions will appear here as consultations are recorded."
          />
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.filter((d) => d.count > 0)}
                  dataKey="count"
                  nameKey="name"
                  cx="50%"
                  cy="45%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={3}
                >
                  {data.map((entry, index) => {
                    const color = entry.name === 'Others'
                      ? '#CBD5E1'
                      : BLUE_TINTS[index % (BLUE_TINTS.length - 1)]
                    return <Cell key={`cell-${index}`} fill={color} />
                  })}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const item = payload[0]
                      return (
                        <div
                          style={{
                            background: '#FFFFFF',
                            border: '1px solid #CBD5E1',
                            borderRadius: 6,
                            padding: '6px 12px',
                            fontSize: '0.78rem',
                            boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                          }}
                        >
                          <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.name}</div>
                          <div style={{ color: '#2563EB', fontWeight: 700, marginTop: 2 }}>
                            {item.value} record{item.value === 1 ? '' : 's'} ({item.payload.percentage}%)
                          </div>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={42}
                  iconSize={8}
                  iconType="circle"
                  formatter={(val, entry) => {
                    const count = entry.payload?.count ?? entry.payload?.value ?? 0
                    const pct = entry.payload?.percentage ?? 0
                    return (
                      <span style={{ fontSize: '0.74rem', color: '#334155', fontWeight: 500, marginRight: 8 }}>
                        {val} <strong style={{ color: '#0F172A' }}>({count} · {pct}%)</strong>
                      </span>
                    )
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  )
}
