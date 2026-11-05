import Dropdown from '../Dropdown'
import { CONDITION_MAP, TOOTH_CONDITIONS, deriveDefaultCondition } from '../../utils/dentalChart'

// FDI notation quadrants
const QUADRANTS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft:  [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft:  [31, 32, 33, 34, 35, 36, 37, 38],
}

/**
 * Affected teeth (odontogram) and the condition each selected tooth gets in the patient's dental chart.
 * Shared by every place a dental consultation is recorded.
 */
export default function DentalTeethSection({ teethMap, selected, conditions, serviceName, onToggle, onConditionChange }) {
  const renderTooth = (num) => {
    const cond = teethMap[num]?.condition || 'healthy'
    const style = CONDITION_MAP[cond] || CONDITION_MAP.healthy
    const isSelected = selected.includes(num)
    return (
      <button
        key={num}
        type="button"
        onClick={() => onToggle(num)}
        title={`Tooth #${num}: ${style.label}`}
        aria-pressed={isSelected}
        style={{
          width: '42px', height: '50px', flexShrink: 0,
          borderRadius: 'var(--radius-sm)',
          background: style.bg,
          border: `2px solid ${isSelected ? 'var(--accent)' : style.border}`,
          boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.3)' : 'var(--shadow-xs)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', transition: 'all var(--transition)',
          transform: isSelected ? 'scale(1.07)' : 'scale(1)',
          position: 'relative', outline: 'none',
        }}
      >
        {isSelected && (
          <div style={{
            position: 'absolute', top: '-5px', right: '-5px',
            width: '13px', height: '13px', borderRadius: '50%',
            background: 'var(--accent)', color: '#fff',
            fontSize: '8px', fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✓</div>
        )}
        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: style.color }}>#{num}</span>
        <span style={{ fontSize: '0.58rem', fontWeight: 600, color: style.color, textTransform: 'uppercase', marginTop: '1px' }}>
          {cond === 'healthy' ? 'OK' : cond.slice(0, 4)}
        </span>
      </button>
    )
  }

  const archLabel = { textAlign: 'center', fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.5rem', letterSpacing: '0.05em' }
  const row = { display: 'flex', justifyContent: 'center', gap: '1rem' }
  const quad = { display: 'flex', gap: '0.3rem' }

  return (
    <>
      <div className="consult-legend">
        {TOOTH_CONDITIONS.map((c) => (
          <div key={c.key} className="consult-legend-item" style={{ background: c.bg, border: `1px solid ${c.border}` }}>
            <span className="consult-legend-dot" style={{ background: c.dot }} />
            <span style={{ color: c.color, fontWeight: 600 }}>{c.label}</span>
          </div>
        ))}
      </div>

      <div style={{ overflowX: 'auto', background: 'var(--bg-crust)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
        <div style={{ minWidth: '640px', padding: '1rem' }}>
          <div style={archLabel}>── MAXILLARY ARCH (UPPER) ──</div>
          <div style={{ ...row, marginBottom: '0.75rem' }}>
            <div style={quad}>{QUADRANTS.upperRight.map(renderTooth)}</div>
            <div style={{ width: '2px', background: 'var(--accent)', opacity: 0.3 }} title="Midline" />
            <div style={quad}>{QUADRANTS.upperLeft.map(renderTooth)}</div>
          </div>
          <div style={archLabel}>── MANDIBULAR ARCH (LOWER) ──</div>
          <div style={row}>
            <div style={quad}>{QUADRANTS.lowerRight.map(renderTooth)}</div>
            <div style={{ width: '2px', background: 'var(--accent)', opacity: 0.3 }} title="Midline" />
            <div style={quad}>{QUADRANTS.lowerLeft.map(renderTooth)}</div>
          </div>
        </div>
      </div>

      {selected.length > 0 && (
        <div>
          <p className="form-hint" style={{ margin: '0 0 0.5rem' }}>
            Each selected tooth is saved to the patient's dental chart with this condition:
          </p>
          <div className="consult-tooth-list">
            {selected.map((num) => (
              <div key={num} className="consult-tooth-row">
                <span style={{ fontWeight: 700, fontSize: '0.82rem', color: 'var(--accent)' }}>Tooth #{num}</span>
                <Dropdown
                  variant="compact"
                  ariaLabel={`Condition of tooth ${num}`}
                  value={conditions[num] || deriveDefaultCondition(serviceName)}
                  onChange={(v) => onConditionChange(num, v)}
                  options={TOOTH_CONDITIONS.map((c) => ({ value: c.key, label: c.label }))}
                  style={{ flex: 1, minWidth: 0 }}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
