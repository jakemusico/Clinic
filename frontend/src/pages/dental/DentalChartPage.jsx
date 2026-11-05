import { useEffect, useState } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import Dropdown from '../../components/Dropdown'
import { dentalApi } from '../../api/dental'
import { recordsApi } from '../../api/records'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'
import { EMPTY } from '../../utils/emptyValue'

// FDI Notation Quadrants
const QUADRANTS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft:  [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft:  [31, 32, 33, 34, 35, 36, 37, 38],
}

const CONDITIONS = [
  { key: 'healthy',   label: 'Healthy',               bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)', dot: '#16A34A' },
  { key: 'cavity',    label: 'Cavity / Caries',       bg: 'var(--red-bg)',   color: 'var(--red)',   border: 'var(--red-border)',   dot: '#DC2626' },
  { key: 'filled',    label: 'Filled / Restoration',  bg: 'var(--blue-bg)',  color: 'var(--blue)',  border: 'var(--blue-border)',  dot: '#2563EB' },
  { key: 'extracted', label: 'Extracted',             bg: '#F1F5F9',         color: '#1E293B',      border: '#CBD5E1',             dot: '#1E293B' },
  { key: 'missing',   label: 'Missing',               bg: '#F8FAFC',         color: '#64748B',      border: '#E2E8F0',             dot: '#64748B' },
  { key: 'treated',   label: 'Crown / Root Canal',    bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-border)', dot: '#D97706' },
]

const CONDITION_MAP = CONDITIONS.reduce((acc, curr) => {
  acc[curr.key] = curr
  return acc
}, {})

export default function DentalChartPage() {
  const { user } = useAuth()
  const isDentist = user?.role === 'dentist'
  const [loading, setLoading]           = useState(false)
  const [patients, setPatients]         = useState([])
  const [selectedPatientId, setSelectedPatientId] = useState('')
  const [teethMap, setTeethMap]         = useState({})
  const [history, setHistory]           = useState([])
  const [selectedTooth, setSelectedTooth] = useState(null)

  // Update form state
  const [condition, setCondition]       = useState('cavity')
  const [notes, setNotes]               = useState('')
  const [updating, setUpdating]         = useState(false)

  useEffect(() => {
    loadPatients()
  }, [])

  const loadPatients = async () => {
    try {
      const res = await recordsApi.patients()
      const list = res.data.patients || []
      setPatients(list)
      if (list.length > 0) {
        setSelectedPatientId(list[0].id)
        loadChart(list[0].id)
      }
    } catch (err) {
      toast.error('Failed to load patient list.')
    }
  }

  const loadChart = async (patientId) => {
    if (!patientId) return
    try {
      setLoading(true)
      const res = await dentalApi.getChart(patientId)
      setTeethMap(res.data.latest_teeth || {})
      setHistory(res.data.history || [])
    } catch (err) {
      toast.error('Failed to load dental chart.')
    } finally {
      setLoading(false)
    }
  }

  const handlePatientChange = (id) => {
    setSelectedPatientId(id)
    setSelectedTooth(null)
    loadChart(id)
  }

  const handleToothClick = (toothNum) => {
    setSelectedTooth(toothNum)
    const existing = teethMap[toothNum]
    if (existing) {
      setCondition(existing.condition)
      setNotes(existing.notes || '')
    } else {
      setCondition('cavity')
      setNotes('')
    }
  }

  const handleUpdateTooth = async (e) => {
    e.preventDefault()
    if (!selectedPatientId || !selectedTooth) return

    try {
      setUpdating(true)
      await dentalApi.updateTooth(selectedPatientId, {
        tooth_number: selectedTooth,
        condition,
        notes,
      })
      toast.success(`Tooth #${selectedTooth} condition updated to ${CONDITION_MAP[condition]?.label || condition}!`)
      loadChart(selectedPatientId)
      setSelectedTooth(null)
    } catch (err) {
      toast.error('Failed to update tooth condition.')
    } finally {
      setUpdating(false)
    }
  }

  const renderToothSquare = (num) => {
    const data = teethMap[num]
    const condKey = data?.condition || 'healthy'
    const styleObj = CONDITION_MAP[condKey] || CONDITION_MAP.healthy
    const isSelected = selectedTooth === num

    return (
      <button
        key={num}
        type="button"
        onClick={() => handleToothClick(num)}
        style={{
          width: '48px',
          height: '56px',
          borderRadius: 'var(--radius-sm)',
          background: styleObj.bg,
          border: `1.5px solid ${isSelected ? 'var(--accent)' : styleObj.border}`,
          boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.25)' : 'var(--shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all var(--transition)',
          transform: isSelected ? 'scale(1.05)' : 'scale(1)',
          position: 'relative',
        }}
        title={`Tooth #${num}: ${styleObj.label}`}
      >
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: styleObj.color }}>
          #{num}
        </span>
        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: styleObj.color, textTransform: 'uppercase', marginTop: '1px' }}>
          {condKey === 'healthy' ? 'OK' : condKey.slice(0, 4)}
        </span>
      </button>
    )
  }

  return (
    <DashboardLayout
      title="Dental Charting (Odontogram)"
      subtitle="Interactive tooth status mapping and historical record keeping."
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* 1. Styled Patient Selector Card */}
        <div className="data-table-wrap" style={{ padding: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <label className="quick-links-section-title" style={{ margin: 0, minWidth: '130px' }}>
              Select Patient:
            </label>
            <div style={{ flex: 1, minWidth: '260px' }}>
              <Dropdown
                variant="filter"
                value={String(selectedPatientId ?? '')}
                onChange={(v) => handlePatientChange(v)}
                options={patients.map(p => ({
                  value: String(p.id),
                  label: `${p.name} — Student/Staff ID: ${p.student_id || 'N/A'}`,
                  badge: p.email,
                }))}
                placeholder="Select patient"
                noOptionsMessage="No patients available"
              />
            </div>
          </div>
        </div>

        {/* 2. Styled Legend Card */}
        <div className="data-table-wrap" style={{ padding: '1rem 1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <span className="quick-links-section-title" style={{ margin: 0 }}>Legend:</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.6rem', alignItems: 'center' }}>
              {CONDITIONS.map(c => (
                <div
                  key={c.key}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.3rem 0.75rem',
                    borderRadius: 'var(--radius-full)',
                    background: c.bg,
                    border: `1px solid ${c.border}`,
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: c.color,
                  }}
                >
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.dot }} />
                  {c.label}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 3. Anatomical Odontogram Chart Card */}
        <div className="data-table-wrap" style={{ padding: '1.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>
              Adult Anatomical Odontogram (FDI 2-Digit System)
            </h3>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
              Click on any tooth square to update its condition or inspect past clinical observations.
            </p>
          </div>

          {loading ? (
            <div className="table-loading"><span className="loader-ring" /></div>
          ) : (
            <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
              <div style={{ minWidth: '780px', display: 'flex', flexDirection: 'column', gap: '1.75rem' }}>
                
                {/* Maxillary Arch (Upper) */}
                <div>
                  <div className="quick-links-section-title" style={{ textAlign: 'center', marginBottom: '0.85rem' }}>
                    ── MAXILLARY ARCH (UPPER) ──
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem' }}>
                    {/* Upper Right Quadrant 1 */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {QUADRANTS.upperRight.map(renderToothSquare)}
                    </div>
                    {/* Quadrant Divider */}
                    <div style={{ width: '2px', height: '60px', background: 'var(--accent)', opacity: 0.3 }} title="Midline" />
                    {/* Upper Left Quadrant 2 */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {QUADRANTS.upperLeft.map(renderToothSquare)}
                    </div>
                  </div>
                </div>

                <div style={{ borderBottom: '1px dashed var(--border)', margin: '0 2rem' }} />

                {/* Mandibular Arch (Lower) */}
                <div>
                  <div className="quick-links-section-title" style={{ textAlign: 'center', marginBottom: '0.85rem' }}>
                    ── MANDIBULAR ARCH (LOWER) ──
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem' }}>
                    {/* Lower Right Quadrant 4 */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {QUADRANTS.lowerRight.map(renderToothSquare)}
                    </div>
                    {/* Quadrant Divider */}
                    <div style={{ width: '2px', height: '60px', background: 'var(--accent)', opacity: 0.3 }} title="Midline" />
                    {/* Lower Left Quadrant 3 */}
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {QUADRANTS.lowerLeft.map(renderToothSquare)}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>

        {/* 4. Tooth Status Update Modal */}
        {selectedTooth && (
          <div className="modal-overlay" onClick={() => setSelectedTooth(null)}>
            <div className="modal-card" style={{ maxWidth: '560px' }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <h2>{isDentist ? `Update Tooth #${selectedTooth} Condition` : `Tooth #${selectedTooth} Details (View Only)`}</h2>
                <button className="modal-close" onClick={() => setSelectedTooth(null)}>✕</button>
              </div>

              <form onSubmit={handleUpdateTooth}>
                <div className="modal-body">
                  <div className="form-group">
                    <label>Tooth Condition *</label>
                    <Dropdown
                      value={condition}
                      onChange={(v) => setCondition(v)}
                      options={CONDITIONS.map(c => ({ value: c.key, label: c.label }))}
                      placeholder="Select condition"
                      disabled={!isDentist}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label>Clinical Notes / Observations</label>
                    <textarea
                      rows="3"
                      placeholder={isDentist ? "e.g. Occlusal caries noted, restoration filled with composite material..." : "None recorded"}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      disabled={!isDentist}
                    />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className={isDentist ? "btn-ghost" : "btn-primary"} onClick={() => setSelectedTooth(null)}>
                    {isDentist ? 'Cancel' : 'Close'}
                  </button>
                  {isDentist && (
                    <button type="submit" className="btn-primary" disabled={updating}>
                      {updating ? <span className="btn-spinner" /> : 'Save Condition'}
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 5. Historical Audit Logs Table */}
        <div className="data-table-wrap">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
              Tooth Condition History Log
            </span>
          </div>

          {history.length === 0 ? (
            <div className="empty-state">
              <p>No historical tooth entries recorded for this patient yet.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date & Time</th>
                  <th>Tooth</th>
                  <th>Status</th>
                  <th>Clinical Notes</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const styleObj = CONDITION_MAP[h.condition] || CONDITION_MAP.healthy
                  return (
                    <tr key={h.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                      <td style={{ fontWeight: 800 }}>Tooth #{h.tooth_number}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.35rem',
                            padding: '0.2rem 0.65rem',
                            borderRadius: 'var(--radius-full)',
                            background: styleObj.bg,
                            border: `1px solid ${styleObj.border}`,
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            color: styleObj.color,
                          }}
                        >
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: styleObj.dot }} />
                          {styleObj.label}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-sub)' }}>{h.notes || EMPTY}</td>
                      <td style={{ fontSize: '0.82rem' }}>{h.recorded_by?.name || 'Dentist'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </DashboardLayout>
  )
}
