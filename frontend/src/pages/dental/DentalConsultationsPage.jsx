import { useEffect, useState, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import DashboardLayout from '../../components/DashboardLayout'
import PrintableRecord from '../../components/PrintableRecord'
import { ViewDentalConsultationModal } from '../../components/ViewDentalConsultationModal'
import Pagination from '../../components/Pagination'
import StyledSelect, { DateInput } from '../../components/StyledSelect'
import { dentalApi } from '../../api/dental'
import { recordsApi } from '../../api/records'
import { servicesApi } from '../../api/services'
import { toast } from 'react-hot-toast'
import { useAuth } from '../../context/AuthContext'

// FDI Notation Quadrants
const QUADRANTS = {
  upperRight: [18, 17, 16, 15, 14, 13, 12, 11],
  upperLeft: [21, 22, 23, 24, 25, 26, 27, 28],
  lowerRight: [48, 47, 46, 45, 44, 43, 42, 41],
  lowerLeft: [31, 32, 33, 34, 35, 36, 37, 38],
}

const CONDITIONS = [
  { key: 'healthy', label: 'Healthy', bg: 'var(--green-bg)', color: 'var(--green)', border: 'var(--green-border)', dot: '#16A34A' },
  { key: 'cavity', label: 'Cavity / Caries', bg: 'var(--red-bg)', color: 'var(--red)', border: 'var(--red-border)', dot: '#DC2626' },
  { key: 'filled', label: 'Filled / Restoration', bg: 'var(--blue-bg)', color: 'var(--blue)', border: 'var(--blue-border)', dot: '#2563EB' },
  { key: 'extracted', label: 'Extracted', bg: '#F1F5F9', color: '#1E293B', border: '#CBD5E1', dot: '#1E293B' },
  { key: 'missing', label: 'Missing', bg: '#F8FAFC', color: '#64748B', border: '#E2E8F0', dot: '#64748B' },
  { key: 'treated', label: 'Crown / Root Canal', bg: 'var(--amber-bg)', color: 'var(--amber)', border: 'var(--amber-border)', dot: '#D97706' },
]

const CONDITION_MAP = CONDITIONS.reduce((acc, curr) => {
  acc[curr.key] = curr
  return acc
}, {})

export default function DentalConsultationsPage() {
  const { user } = useAuth()
  const isDentist = user?.role === 'dentist'
  const location = useLocation()
  const navigate = useNavigate()
  const prefilledAppt = location.state?.appointment

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [patients, setPatients] = useState([])
  const [services, setServices] = useState([])
  const [consultations, setConsultations] = useState([])
  const [teethMap, setTeethMap] = useState({})
  const [activeTab, setActiveTab] = useState('list') // 'list' | 'new'
  const [viewConsultation, setViewConsultation] = useState(null)

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterService, setFilterService] = useState('all')
  const [filterDentist, setFilterDentist] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [filterPopoverOpen, setFilterPopoverOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)

  // Form State
  const [formData, setFormData] = useState({
    patient_id: prefilledAppt?.patient_id || '',
    appointment_id: prefilledAppt?.id || '',
    consultation_date: new Date().toISOString().split('T')[0],
    service_name: prefilledAppt?.service?.name || '',
    reason_for_visit: prefilledAppt?.notes || '',
    complaint_category: '',
    affected_teeth: [],
    dental_findings: '',
    diagnosis: prefilledAppt?.service?.name || '',
    treatment_performed: '',
    recommendations: '',
    notes: '',
    staff_notes: '',
    status: 'completed',
  })
  const [toothConditions, setToothConditions] = useState({})

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    const clean = typeof dateStr === 'string' && dateStr.includes('T') ? dateStr.split('T')[0] : dateStr
    const d = new Date(clean + 'T00:00:00')
    if (isNaN(d.getTime())) return String(dateStr)
    return d.toLocaleDateString('en-PH', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const distinctServices = useMemo(() => {
    const set = new Set()
    consultations.forEach(c => {
      const s = c.appointment?.service?.name || c.diagnosis
      if (s) set.add(s)
    })
    services.forEach(s => set.add(s.name))
    return Array.from(set).sort()
  }, [consultations, services])

  const distinctDentists = useMemo(() => {
    const set = new Set()
    consultations.forEach(c => {
      if (c.dentist?.name) set.add(c.dentist.name)
    })
    return Array.from(set).sort()
  }, [consultations])

  const filteredConsultations = useMemo(() => {
    return consultations.filter(c => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const patientName = (c.patient?.user?.name || '').toLowerCase()
        const studentId = (c.patient?.user?.student_id || '').toLowerCase()
        const serviceName = (c.appointment?.service?.name || c.diagnosis || '').toLowerCase()
        const reason = (c.reason_for_visit || '').toLowerCase()
        const findings = (c.dental_findings || '').toLowerCase()
        const treatment = (c.treatment_performed || '').toLowerCase()
        const dentistName = (c.dentist?.name || '').toLowerCase()
        const matches = patientName.includes(q) ||
          studentId.includes(q) ||
          serviceName.includes(q) ||
          reason.includes(q) ||
          findings.includes(q) ||
          treatment.includes(q) ||
          dentistName.includes(q)
        if (!matches) return false
      }

      // 2. Service Filter
      if (filterService !== 'all') {
        const serviceName = c.appointment?.service?.name || c.diagnosis || ''
        if (serviceName !== filterService) return false
      }

      // 3. Dentist Filter
      if (filterDentist !== 'all') {
        const dentistName = c.dentist?.name || ''
        if (dentistName !== filterDentist) return false
      }

      // 4. Date Range Filter
      if (dateFrom || dateTo) {
        const cDate = typeof c.consultation_date === 'string' && c.consultation_date.includes('T')
          ? c.consultation_date.split('T')[0]
          : c.consultation_date
        if (dateFrom && cDate < dateFrom) return false
        if (dateTo && cDate > dateTo) return false
      }

      return true
    })
  }, [consultations, searchQuery, filterService, filterDentist, dateFrom, dateTo])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, filterService, filterDentist, dateFrom, dateTo])

  const totalPages = Math.max(1, Math.ceil(filteredConsultations.length / pageSize))
  const paginatedConsultations = filteredConsultations.slice((page - 1) * pageSize, page * pageSize)

  const activeFilterCount = (filterService !== 'all' ? 1 : 0) +
    (filterDentist !== 'all' ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo ? 1 : 0)

  const deriveDefaultCondition = (serviceName) => {
    const text = (serviceName || '').toLowerCase()
    if (text.includes('extraction') || text.includes('extract') || text.includes('remove')) return 'extracted'
    if (text.includes('filling') || text.includes('restoration') || text.includes('composite')) return 'filled'
    if (text.includes('crown') || text.includes('root canal') || text.includes('treated')) return 'treated'
    if (text.includes('cavity') || text.includes('caries') || text.includes('decay')) return 'cavity'
    return 'healthy'
  }

  useEffect(() => {
    loadInitialData()
    // If navigated here from appointments desk, switch to new tab
    if (prefilledAppt || location.state?.appointment) {
      setActiveTab('new')
    }
    // Handle ?appointment_id query param
    const query = new URLSearchParams(location.search)
    const appointmentId = query.get('appointment_id')
    if (appointmentId && !prefilledAppt) {
      setActiveTab('new')
    }
    // Clear state/query after reading
    navigate('/dental/consultations', { replace: true, state: { appointment: prefilledAppt } })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch patient's dental chart data to populate current tooth statuses
  useEffect(() => {
    if (formData.patient_id) {
      dentalApi.getChart(formData.patient_id)
        .then(res => setTeethMap(res.data.latest_teeth || {}))
        .catch(() => setTeethMap({}))
    } else {
      setTeethMap({})
    }
  }, [formData.patient_id])

  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [pRes, cRes, sRes] = await Promise.all([
        recordsApi.patients(),
        dentalApi.listConsultations(),
        servicesApi.list(),
      ])
      setPatients(pRes.data.patients || [])
      setConsultations(cRes.data.consultations || [])
      // Only show dental services in the dropdown
      const allServices = sRes.data.services || []
      setServices(allServices.filter(s =>
        /dental|tooth|teeth|oral|gum|extraction|dentist/i.test(s.name + ' ' + (s.description || ''))
      ))
    } catch (err) {
      toast.error('Failed to load consultation records.')
    } finally {
      setLoading(false)
    }
  }

  const toggleToothSelect = (toothNum) => {
    setFormData(prev => {
      const exists = prev.affected_teeth.includes(toothNum)
      const updated = exists
        ? prev.affected_teeth.filter(t => t !== toothNum)
        : [...prev.affected_teeth, toothNum].sort((a, b) => a - b)
      return { ...prev, affected_teeth: updated }
    })
    setToothConditions(prev => {
      if (prev[toothNum]) {
        const copy = { ...prev }
        delete copy[toothNum]
        return copy
      } else {
        return { ...prev, [toothNum]: deriveDefaultCondition(formData.service_name) }
      }
    })
  }

  const handleServiceChange = (serviceName) => {
    setFormData(prev => ({
      ...prev,
      service_name: serviceName,
      diagnosis: prev.diagnosis || serviceName,
    }))
    const defaultCond = deriveDefaultCondition(serviceName)
    setToothConditions(prev => {
      const updated = { ...prev }
      formData.affected_teeth.forEach(num => {
        updated[num] = defaultCond
      })
      return updated
    })
  }

  const renderToothSquare = (num) => {
    const data = teethMap[num]
    const condKey = data?.condition || 'healthy'
    const styleObj = CONDITION_MAP[condKey] || CONDITION_MAP.healthy
    const isSelected = formData.affected_teeth.includes(num)

    return (
      <button
        key={num}
        type="button"
        onClick={() => toggleToothSelect(num)}
        style={{
          width: '48px',
          height: '56px',
          borderRadius: 'var(--radius-sm)',
          background: styleObj.bg,
          border: `2px solid ${isSelected ? 'var(--accent)' : styleObj.border}`,
          boxShadow: isSelected ? '0 0 0 3px rgba(37,99,235,0.35)' : 'var(--shadow-xs)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          transition: 'all var(--transition)',
          transform: isSelected ? 'scale(1.06)' : 'scale(1)',
          position: 'relative',
          outline: 'none',
        }}
        title={`Tooth #${num}: ${styleObj.label} (${isSelected ? 'Selected for consultation' : 'Click to select'})`}
      >
        {isSelected && (
          <div
            style={{
              position: 'absolute',
              top: '-5px',
              right: '-5px',
              width: '14px',
              height: '14px',
              borderRadius: '50%',
              background: 'var(--accent)',
              color: '#FFFFFF',
              fontSize: '9px',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
          >
            ✓
          </div>
        )}
        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: styleObj.color }}>
          #{num}
        </span>
        <span style={{ fontSize: '0.62rem', fontWeight: 600, color: styleObj.color, textTransform: 'uppercase', marginTop: '1px' }}>
          {condKey === 'healthy' ? 'OK' : condKey.slice(0, 4)}
        </span>
      </button>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!formData.patient_id) {
      toast.error('Please select a patient.')
      return
    }

    try {
      setSaving(true)
      await dentalApi.createConsultation({
        ...formData,
        tooth_conditions: toothConditions,
        status: 'completed',
      })
      toast.success('Dental consultation record created & dental chart updated!')
      setFormData({
        patient_id: '',
        appointment_id: '',
        consultation_date: new Date().toISOString().split('T')[0],
        service_name: '',
        reason_for_visit: '',
        affected_teeth: [],
        dental_findings: '',
        diagnosis: '',
        treatment_performed: '',
        recommendations: '',
        notes: '',
        staff_notes: '',
        status: 'completed',
      })
      setToothConditions({})
      setActiveTab('list')
      loadInitialData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create dental consultation.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <DashboardLayout
      title="Dental Consultations"
      subtitle="Record patient check-ups, dental findings, and treatment details."
    >
      {/* Navigation Tabs */}
      <div className="tab-bar">
        <button
          className={`tab-btn ${activeTab === 'list' ? 'active' : ''}`}
          onClick={() => setActiveTab('list')}
        >
          Consultation Logs
        </button>
        {isDentist && (
          <button
            className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`}
            onClick={() => setActiveTab('new')}
          >
            + New Dental Consultation
          </button>
        )}
      </div>

      {activeTab === 'new' ? (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', width: '100%' }}>

          {/* Section 1: Patient Information */}
          <div className="modal-card" style={{ maxWidth: '100%' }}>
            <div className="modal-header">
              <h2>1. Patient & Consultation Details</h2>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Select Patient *</label>
                  <select
                    value={formData.patient_id}
                    onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                    required
                  >
                    <option value="">Select patient</option>
                    {patients.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.student_id || p.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Consultation Date *</label>
                  <input
                    type="date"
                    value={formData.consultation_date}
                    onChange={(e) => setFormData({ ...formData, consultation_date: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Dental Service</label>
                <select
                  value={formData.service_name}
                  onChange={(e) => handleServiceChange(e.target.value)}
                >
                  <option value="">Select dental service</option>
                  {services.map(s => (
                    <option key={s.id} value={s.name}>
                      {s.name} ({s.duration_minutes}m)
                    </option>
                  ))}
                  {/* Preserve pre-filled value if not yet in services list */}
                  {formData.service_name && !services.some(s => s.name === formData.service_name) && (
                    <option value={formData.service_name}>{formData.service_name}</option>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>Reason for Visit / Chief Complaint</label>
                <input
                  type="text"
                  placeholder="e.g. Toothache on upper molar, routine cleaning, cavity check..."
                  value={formData.reason_for_visit}
                  onChange={(e) => setFormData({ ...formData, reason_for_visit: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Complaint Category</label>
                <select
                  value={formData.complaint_category || ''}
                  onChange={(e) => setFormData({ ...formData, complaint_category: e.target.value })}
                >
                  <option value="">-- Select Category --</option>
                  <option value="Toothache">Toothache</option>
                  <option value="Dental Cleaning">Dental Cleaning</option>
                  <option value="Extraction">Extraction</option>
                  <option value="Tooth Filling">Tooth Filling</option>
                  <option value="Cavity/Decay">Cavity/Decay</option>
                  <option value="Gum Problem">Gum Problem</option>
                  <option value="Fever/Flu">Fever/Flu</option>
                  <option value="Headache">Headache</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Affected Teeth Selection (Odontogram) */}
          <div className="modal-card" style={{ maxWidth: '100%' }}>
            <div className="modal-header">
              <h2>2. Select Affected Teeth (FDI Notation)</h2>
              <span className="status-badge completed">
                {formData.affected_teeth.length} Teeth Selected
              </span>
            </div>
            <div className="modal-body">
              <p className="form-hint" style={{ marginBottom: '0.85rem' }}>
                Click a tooth square on the anatomical chart to toggle selection for this consultation. Current status is reflected from the patient's dental chart:
              </p>

              {/* Legend Row matching Dental Charting */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginBottom: '1.25rem' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-sub)' }}>Legend:</span>
                {CONDITIONS.map(c => (
                  <div
                    key={c.key}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      padding: '0.25rem 0.65rem',
                      borderRadius: 'var(--radius-full)',
                      background: c.bg,
                      border: `1px solid ${c.border}`,
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: c.color,
                    }}
                  >
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: c.dot }} />
                    {c.label}
                  </div>
                ))}
              </div>

              {/* Anatomical Odontogram Chart */}
              <div style={{ overflowX: 'auto', paddingBottom: '0.5rem' }}>
                <div style={{ minWidth: '760px', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                  {/* Maxillary Arch (Upper) */}
                  <div>
                    <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                      ── MAXILLARY ARCH (UPPER) ──
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {QUADRANTS.upperRight.map(num => renderToothSquare(num))}
                      </div>
                      <div style={{ width: '2px', height: '56px', background: 'var(--accent)', opacity: 0.3 }} title="Midline" />
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {QUADRANTS.upperLeft.map(num => renderToothSquare(num))}
                      </div>
                    </div>
                  </div>

                  <div style={{ borderBottom: '1px dashed var(--border)', margin: '0 2rem' }} />

                  {/* Mandibular Arch (Lower) */}
                  <div>
                    <div style={{ textAlign: 'center', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.05em', color: 'var(--text-muted)', marginBottom: '0.6rem' }}>
                      ── MANDIBULAR ARCH (LOWER) ──
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {QUADRANTS.lowerRight.map(num => renderToothSquare(num))}
                      </div>
                      <div style={{ width: '2px', height: '56px', background: 'var(--accent)', opacity: 0.3 }} title="Midline" />
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {QUADRANTS.lowerLeft.map(num => renderToothSquare(num))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tooth Condition Chart Auto-Update */}
              {formData.affected_teeth.length > 0 && (
                <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Tooth Condition History Log</span>
                      <p className="form-hint" style={{ margin: '0.15rem 0 0 0' }}>
                        Each selected tooth will update the patient's Dental Chart with this status:
                      </p>
                    </div>
                    <span className="status-badge role-blue" style={{ fontSize: '0.75rem' }}>
                      Auto-Logged to Chart
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.6rem' }}>
                    {formData.affected_teeth.map(num => (
                      <div
                        key={num}
                        style={{
                          background: 'var(--bg-crust)',
                          padding: '0.55rem 0.8rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--accent)' }}>
                          Tooth #{num}
                        </span>
                        <select
                          value={toothConditions[num] || deriveDefaultCondition(formData.service_name)}
                          onChange={(e) => setToothConditions(prev => ({ ...prev, [num]: e.target.value }))}
                          style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', width: 'auto', flex: 1 }}
                        >
                          <option value="extracted">Extracted</option>
                          <option value="filled">Filled / Restoration</option>
                          <option value="treated">Crown / Root Canal</option>
                          <option value="cavity">Cavity / Caries</option>
                          <option value="healthy">Healthy</option>
                          <option value="missing">Missing</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 3: Clinical Findings & Treatment */}
          <div className="modal-card" style={{ maxWidth: '100%' }}>
            <div className="modal-header">
              <h2>3. Clinical Findings & Treatment</h2>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label>Diagnosis</label>
                  <input
                    type="text"
                    placeholder="e.g. Dental Caries, Gingivitis, Impacted Tooth..."
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Dental Findings</label>
                  <input
                    type="text"
                    placeholder="e.g. Deep occlusal cavity on tooth #16..."
                    value={formData.dental_findings}
                    onChange={(e) => setFormData({ ...formData, dental_findings: e.target.value })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Treatment Performed</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Composite restoration, oral prophylaxis..."
                  value={formData.treatment_performed}
                  onChange={(e) => setFormData({ ...formData, treatment_performed: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label>Recommendations / Instructions</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Avoid hot food for 2 hours, brush twice daily..."
                  value={formData.recommendations}
                  onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Patient-Visible Notes</label>
                  <textarea
                    rows="2"
                    placeholder="Notes shown to student/staff in health portal"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label style={{ color: 'var(--red)' }}>Dentist Private Notes (Internal Only)</label>
                  <textarea
                    rows="2"
                    placeholder="Private clinical observations hidden from patient"
                    value={formData.staff_notes}
                    onChange={(e) => setFormData({ ...formData, staff_notes: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="button" className="btn-ghost" onClick={() => setActiveTab('list')}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? <span className="btn-spinner" /> : 'Save Consultation Record'}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        /* Consultation Logs Table with Search and Filters */
        <div>
          {/* Search and Filters Toolbar */}
          <div className="page-toolbar" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '280px', position: 'relative' }}>
              <input
                type="text"
                className="search-input"
                style={{ width: '100%', boxSizing: 'border-box' }}
                placeholder="Search by patient name, student ID, or service..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    padding: '2px 6px',
                  }}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <div style={{ position: 'relative' }}>
              <button
                type="button"
                className={`filter-btn-outline ${activeFilterCount > 0 ? 'active' : ''}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.55rem 1rem',
                  borderRadius: 'var(--radius-full)',
                  border: activeFilterCount > 0 ? '1.5px solid var(--accent)' : '1px solid var(--border)',
                  background: activeFilterCount > 0 ? 'var(--accent-light)' : '#FFFFFF',
                  color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text)',
                  fontWeight: 600,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
                onClick={() => setFilterPopoverOpen(!filterPopoverOpen)}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="status-tab-count" style={{ background: 'var(--accent)', color: '#fff', padding: '0.1rem 0.45rem', borderRadius: 'var(--radius-full)', fontSize: '0.75rem' }}>
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {/* Filters Dropdown Popover */}
              {filterPopoverOpen && (
                <div className="filter-popover-card" style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', zIndex: 100, background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem', width: '280px', boxShadow: 'var(--shadow-lg)' }}>
                  <div className="filter-popover-group" style={{ marginBottom: '0.85rem' }}>
                    <div className="filter-popover-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.35rem' }}>
                      Dental Service
                    </div>
                    <StyledSelect
                      value={filterService}
                      onChange={e => setFilterService(e.target.value)}
                    >
                      <option value="all">All Dental Services</option>
                      {distinctServices.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </StyledSelect>
                  </div>

                  {distinctDentists.length > 1 && (
                    <div className="filter-popover-group" style={{ marginBottom: '0.85rem' }}>
                      <div className="filter-popover-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.35rem' }}>
                        Attending Dentist
                      </div>
                      <StyledSelect
                        value={filterDentist}
                        onChange={e => setFilterDentist(e.target.value)}
                      >
                        <option value="all">All Dentists</option>
                        {distinctDentists.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </StyledSelect>
                    </div>
                  )}

                  <div className="filter-popover-group" style={{ marginBottom: '0.85rem' }}>
                    <div className="filter-popover-title" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-sub)', marginBottom: '0.35rem' }}>
                      Date Range
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      <DateInput
                        label="From"
                        value={dateFrom}
                        onChange={e => setDateFrom(e.target.value)}
                        max={dateTo || undefined}
                        style={{ width: '100%' }}
                      />
                      <DateInput
                        label="To"
                        value={dateTo}
                        onChange={e => setDateTo(e.target.value)}
                        min={dateFrom || undefined}
                        style={{ width: '100%' }}
                      />
                    </div>
                  </div>

                  {activeFilterCount > 0 && (
                    <button
                      type="button"
                      style={{
                        width: '100%',
                        padding: '0.4rem',
                        background: 'none',
                        border: 'none',
                        color: 'var(--accent)',
                        fontWeight: 600,
                        fontSize: '0.8rem',
                        cursor: 'pointer',
                        textAlign: 'center',
                        borderTop: '1px solid var(--border)',
                        paddingTop: '0.6rem',
                        marginTop: '0.4rem',
                      }}
                      onClick={() => {
                        setFilterService('all')
                        setFilterDentist('all')
                        setDateFrom('')
                        setDateTo('')
                      }}
                    >
                      Reset all filters
                    </button>
                  )}
                </div>
              )}
            </div>

            {(searchQuery || activeFilterCount > 0) && (
              <button
                type="button"
                className="btn-ghost"
                style={{ fontSize: '0.82rem', padding: '0.5rem 0.75rem' }}
                onClick={() => {
                  setSearchQuery('')
                  setFilterService('all')
                  setFilterDentist('all')
                  setDateFrom('')
                  setDateTo('')
                }}
              >
                Clear All
              </button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <div className="table-loading"><span className="loader-ring" /></div>
          ) : filteredConsultations.length === 0 ? (
            <div className="empty-state" style={{ background: '#FFFFFF', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '3rem 1.5rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
                {searchQuery || activeFilterCount > 0
                  ? 'No dental consultations match your search or filter criteria.'
                  : 'No dental consultations recorded yet.'}
              </p>
              {(searchQuery || activeFilterCount > 0) && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setSearchQuery('')
                    setFilterService('all')
                    setFilterDentist('all')
                    setDateFrom('')
                    setDateTo('')
                  }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <>
              <div className="data-table-wrap" style={{ overflowX: 'auto', width: '100%', boxShadow: 'var(--shadow-sm)', borderRadius: 'var(--radius-md)' }}>
              <table className="data-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ width: '140px' }}>Date</th>
                    <th>Patient</th>
                    <th>Service</th>
                    <th style={{ width: '130px' }}>Status</th>
                    <th>Attending Dentist</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedConsultations.map((c) => {
                    const patientUser = c.patient?.user || {}
                    const serviceName = c.appointment?.service?.name || c.diagnosis || 'Dental Consultation'
                    const status = c.status || 'completed'
                    return (
                      <tr key={c.id}>
                        <td style={{ fontWeight: 600, fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {formatDate(c.consultation_date)}
                        </td>
                        <td className="td-name" style={{ whiteSpace: 'nowrap' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                            {patientUser.name || 'Patient'}
                          </div>
                          {patientUser.student_id ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              ID: {patientUser.student_id}
                            </div>
                          ) : patientUser.email ? (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {patientUser.email}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                          {serviceName}
                        </td>
                        <td>
                          <span className={`status-badge ${status}`} style={{ textTransform: 'capitalize' }}>
                            {status}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                          {c.dentist?.name || 'Dentist'}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            type="button"
                            className="btn-secondary"
                            style={{ padding: '0.35rem 0.85rem', fontSize: '0.78rem' }}
                            onClick={() => setViewConsultation(c)}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              </div>

              <Pagination
                currentPage={page}
                totalPages={totalPages}
                totalItems={filteredConsultations.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={(newSize) => {
                  setPageSize(newSize)
                  setPage(1)
                }}
              />
            </>
          )}
        </div>
      )}

      {viewConsultation && (
        <ViewDentalConsultationModal
          record={viewConsultation}
          onClose={() => setViewConsultation(null)}
        />
      )}
    </DashboardLayout>
  )
}
