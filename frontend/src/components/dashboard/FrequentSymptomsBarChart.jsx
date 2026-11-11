import React from 'react'
import {
  BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import ChartCard from './ChartCard'
import EmptyState from './EmptyState'

const BAR_COLOR = '#2563EB'
const OTHERS_COLOR = '#CBD5E1'

function isOthersName(name) {
  return name === 'Other' || name === 'Others'
}

/**
 * Horizontal bar chart of the top complaint categories, styled like the
 * Reports page "Case Frequency by Symptom" chart. Used on the Nurse, Dentist
 * and Admin dashboards so all symptom charts look identical.
 *
 * Props: data [{name, count, percentage?}], loading, categorized, total, topN (default 5)
 */
export default function FrequentSymptomsBarChart({ data = [], loading = false, topN = 5 }) {
  const totalCount = data.reduce((sum, d) => sum + (d.count || 0), 0)

  // Merge "Other"/"Others" (incl. the medical + dental "Others" of combined data),
  // sort by count desc, keep top N, group the rest into one "Others" bar
  const merged = new Map()
  for (const d of data) {
    if (!d.count) continue
    const key = isOthersName(d.name) ? 'Others' : d.name
    merged.set(key, (merged.get(key) || 0) + d.count)
  }
  const sorted = [...merged.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)

  const top = sorted.slice(0, topN)
  const restCount = sorted.slice(topN).reduce((sum, r) => sum + r.count, 0)
  const topOthers = top.find(r => r.name === 'Others')
  const rows = top.filter(r => r.name !== 'Others')
    .map(r => ({ ...r, percentage: totalCount > 0 ? +((r.count / totalCount) * 100).toFixed(1) : 0 }))
  const othersCount = (topOthers?.count || 0) + restCount
  if (othersCount > 0) {
    rows.push({
      name: 'Others',
      count: othersCount,
      percentage: totalCount > 0 ? +((othersCount / totalCount) * 100).toFixed(1) : 0,
    })
  }

  return (
    <ChartCard
      title="Frequent Symptoms"
      subtitle="Top complaint categories"
      badge={`${totalCount} log${totalCount === 1 ? '' : 's'}`}
    >
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
        <div style={{ flex: 1, minHeight: 0, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#EEF2F7" vertical={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                allowDecimals={false}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                width={120}
              />
              <Tooltip
                cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null
                  const item = payload[0].payload
                  return (
                    <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, padding: '6px 12px', fontSize: '0.78rem', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                      <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.name}</div>
                      <div style={{ color: '#2563EB', fontWeight: 700, marginTop: 2 }}>
                        {item.count} record{item.count === 1 ? '' : 's'} ({item.percentage}%)
                      </div>
                    </div>
                  )
                }}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]} name="Cases">
                {rows.map((row) => (
                  <Cell key={row.name} fill={row.name === 'Others' ? OTHERS_COLOR : BAR_COLOR} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </ChartCard>
  )
}
