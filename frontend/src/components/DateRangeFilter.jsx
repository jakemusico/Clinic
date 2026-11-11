import { useState } from 'react'
import DateInput from './DateInput'
import { presetRange, rangeLabel } from '../utils/dateRange'

const PRESETS = ['Today', 'This Week', 'This Month', 'This Quarter', 'All Time', 'Custom']

/**
 * Shared date-range selector: preset pills + custom date inputs.
 * value: { preset, from, to } — from/to are YYYY-MM-DD ('' = unbounded).
 * onChange(next) is called with the same shape.
 */
export default function DateRangeFilter({ value, onChange }) {
  const [customOpen, setCustomOpen] = useState(false)
  const preset = value?.preset || 'This Month'

  const pick = (label) => {
    const r = presetRange(label, value)
    onChange({ preset: label, from: r.from, to: r.to })
    setCustomOpen(label === 'Custom')
  }

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.4rem 0.75rem' }}>
        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
          {PRESETS.map(p => (
            <button
              key={p}
              type="button"
              onClick={() => pick(p)}
              style={{
                padding: '0.25rem 0.75rem',
                borderRadius: 'var(--radius-full)',
                border: preset === p ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                background: preset === p ? 'var(--accent-light)' : '#FFFFFF',
                color: preset === p ? 'var(--accent)' : 'var(--text)',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              {p}
            </button>
          ))}
        </div>
        <p style={{ margin: 0, marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          Showing data for {rangeLabel(value)}
        </p>
      </div>
      {(customOpen || preset === 'Custom') && (
        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.6rem', flexWrap: 'wrap' }}>
          <DateInput label="From" value={value?.from || ''} max={value?.to || undefined}
            onChange={e => onChange({ ...value, preset: 'Custom', from: e.target.value })} style={{ flex: 1, minWidth: '140px' }} />
          <DateInput label="To" value={value?.to || ''} min={value?.from || undefined}
            onChange={e => onChange({ ...value, preset: 'Custom', to: e.target.value })} style={{ flex: 1, minWidth: '140px' }} />
        </div>
      )}
    </div>
  )
}
