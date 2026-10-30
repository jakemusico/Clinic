import { useState, useEffect, useCallback, useMemo } from 'react'
import { toast } from 'react-hot-toast'
import DashboardLayout from '../../components/DashboardLayout'
import { useAuth } from '../../context/AuthContext'
import { reportsApi } from '../../api/reports'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import { formatAppointmentDate, formatAppointmentTime } from '../../utils/dateUtils'
import { exportReportToPDF, exportReportToCSV } from '../../utils/reportExport'
import Pagination from '../../components/Pagination'
import { usePagination } from '../../hooks/usePagination'
import StyledSelect, { DateInput } from '../../components/StyledSelect'

// (Icon components removed — export buttons use text-only outline style)

// Date helpers
const fmt = (d) => {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}
const today = () => fmt(new Date())

const PRESETS = [
  {
    label: 'Today',
    get: () => { const d = today(); return [d, d] },
  },
  {
    label: 'This Week',
    get: () => {
      const d = new Date()
      const day = d.getDay()
      const mon = new Date(d); mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
      return [fmt(mon), fmt(sun)]
    },
  },
  {
    label: 'This Month',
    get: () => {
      const d = new Date()
      return [
        fmt(new Date(d.getFullYear(), d.getMonth(), 1)),
        fmt(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
      ]
    },
  },
  {
    label: 'This Quarter',
    get: () => {
      const d = new Date()
      const q = Math.floor(d.getMonth() / 3)
      return [
        fmt(new Date(d.getFullYear(), q * 3, 1)),
        fmt(new Date(d.getFullYear(), q * 3 + 3, 0)),
      ]
    },
  },
  { label: 'Custom', get: null },
]

const STATUS_CLS = {
  completed: 'completed',
  cancelled: 'cancelled',
  confirmed: 'role-blue',
  pending:   'role-gold',
}

const BLUE_TINTS = [
  '#2563EB',
  '#3B82F6',
  '#60A5FA',
  '#93C5FD',
  '#1D4ED8',
  '#CBD5E1',
]

const PIE_COLORS = {
  completed: 'var(--green)',
  cancelled: 'var(--red)',
  confirmed: 'var(--blue)',
  pending:   'var(--amber)',
}

function TruncCell({ text, maxLen = 45 }) {
  if (!text) return <span style={{ color: 'var(--text-muted)' }}>—</span>
  const truncated = text.length > maxLen ? text.slice(0, maxLen) + '…' : text
  return <span title={text}>{truncated}</span>
}

export default function ReportsPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isDentist = user?.role === 'dentist'

  // Tabs: appointments | consultations | inventory | symptoms
  const [activeTab, setActiveTab] = useState('appointments')

  // Shared Filters
  const thisMonthStart = fmt(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const thisMonthEnd   = fmt(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0))

  const [dateFrom,     setDateFrom]     = useState(thisMonthStart)
  const [dateTo,       setDateTo]       = useState(thisMonthEnd)
  const [status,       setStatus]       = useState('all')
  const [serviceId,    setServiceId]    = useState('all')
  const [staffId,      setStaffId]      = useState('all')
  const [type,         setType]         = useState(isDentist ? 'dental' : (!isAdmin ? 'medical' : 'all'))
  const [activePreset, setActivePreset] = useState('This Month')
  const [showCustom,   setShowCustom]   = useState(false)

  // Sub-view for Inventory tab: stock | low_stock | expiring | usage
  const [invSubView, setInvSubView] = useState('stock')

  // Shared Filter Options
  const [services,  setServices]  = useState([])
  const [staffList, setStaffList] = useState([])

  // Data states
  const [loading, setLoading] = useState(true)

  // Tab 1: Appointments
  const [appointments, setAppointments] = useState([])
  const [appSummary,   setAppSummary]   = useState({})
  const [appByService, setAppByService] = useState([])
  const [appByDate,    setAppByDate]    = useState([])

  // Tab 2: Consultations
  const [consultations, setConsultations] = useState([])
  const [consSummary,   setConsSummary]   = useState({})
  const [consByDate,    setConsByDate]    = useState([])
  const [consByService, setConsByService] = useState([])

  // Tab 3: Inventory
  const [invSummary,      setInvSummary]      = useState({})
  const [invItems,        setInvItems]        = useState([])
  const [lowStockItems,   setLowStockItems]   = useState([])
  const [expiringBatches, setExpiringBatches] = useState([])
  const [invTransactions, setInvTransactions] = useState([])
  const [invUsageByDate,  setInvUsageByDate]  = useState([])
  const [invByCategory,   setInvByCategory]   = useState([])

  // Tab 4: Frequent Symptoms
  const [symptomCategories,    setSymptomCategories]    = useState([])
  const [allSymptomCategories, setAllSymptomCategories] = useState([])
  const [symptomTotalLogs,     setSymptomTotalLogs]     = useState(0)
  const [symptomConsultations, setSymptomConsultations] = useState([])

  // Tab 5: Chat Summary
  const [chatData, setChatData] = useState({
    total_conversations: 0,
    resolved_conversations: 0,
    open_conversations: 0,
    avg_response_time_minutes: 0,
    unanswered_24h: 0,
    conversations: [],
  })

  // Pagination hooks for report tables
  const appPagination     = usePagination({ items: appointments })
  const consPagination    = usePagination({ items: consultations })
  const invStockPagination = usePagination({ items: invItems })
  const invLowPagination   = usePagination({ items: lowStockItems })
  const invExpPagination   = usePagination({ items: expiringBatches })
  const invTxPagination    = usePagination({ items: invTransactions })
  const symptomPagination = usePagination({ items: symptomConsultations })
  const chatPagination    = usePagination({ items: chatData.conversations || [] })

  // Load report data for the active tab
  const loadTabReport = useCallback(async (tab = activeTab, from = dateFrom, to = dateTo, overrideType = type) => {
    setLoading(true)
    const params = {
      date_from:  from,
      date_to:    to,
      service_id: serviceId,
      staff_id:   staffId,
      ...(isAdmin && overrideType !== 'all' && { type: overrideType }),
    }

    try {
      if (tab === 'appointments') {
        const { data } = await reportsApi.appointmentSummary({
          ...params,
          status,
        })
        setAppointments(data.appointments || [])
        setAppSummary(data.summary || {})
        setAppByService(data.by_service || [])
        setAppByDate(data.by_date || [])
        if (data.filters?.services) setServices(data.filters.services)
        if (data.filters?.staff)    setStaffList(data.filters.staff)
      } else if (tab === 'consultations') {
        const { data } = await reportsApi.consultationSummary(params)
        setConsultations(data.consultations || [])
        setConsSummary(data.summary || {})
        setConsByDate(data.by_date || [])
        setConsByService(data.by_service || [])
        if (data.filters?.services) setServices(data.filters.services)
        if (data.filters?.staff)    setStaffList(data.filters.staff)
      } else if (tab === 'inventory') {
        const { data } = await reportsApi.inventorySummary({
          date_from: from,
          date_to:   to,
        })
        setInvSummary(data.summary || {})
        setInvItems(data.items || [])
        setLowStockItems(data.low_stock_items || [])
        setExpiringBatches(data.expiring_batches || [])
        setInvTransactions(data.transactions || [])
        setInvUsageByDate(data.usage_by_date || [])
        setInvByCategory(data.by_category || [])
      } else if (tab === 'symptoms') {
        const { data } = await reportsApi.symptomsSummary(params)
        setSymptomCategories(data.categories || [])
        setAllSymptomCategories(data.all_categories || [])
        setSymptomTotalLogs(data.total_logs || 0)
        setSymptomConsultations(data.consultations || [])
        if (data.filters?.services) setServices(data.filters.services)
        if (data.filters?.staff)    setStaffList(data.filters.staff)
      } else if (tab === 'chat') {
        const { data } = await reportsApi.chatSummary({
          role_type: overrideType,
          date_from: from,
          date_to: to,
        })
        setChatData(data)
      }
    } catch {
      toast.error('Failed to load report data.')
    } finally {
      setLoading(false)
    }
  }, [activeTab, dateFrom, dateTo, type, status, serviceId, staffId, isAdmin])

  useEffect(() => {
    loadTabReport(activeTab, dateFrom, dateTo, type)
  }, [activeTab, dateFrom, dateTo, type, status, serviceId, staffId, loadTabReport])

  const handlePreset = (preset) => {
    setActivePreset(preset.label)
    if (preset.label === 'Custom') {
      setShowCustom(true)
      return
    }
    setShowCustom(false)
    const [from, to] = preset.get()
    setDateFrom(from)
    setDateTo(to)
  }

  const handleFilterSubmit = (e) => {
    e.preventDefault()
    loadTabReport(activeTab, dateFrom, dateTo, type)
  }

  // (Old window.print() stylesheet removed — PDF export now uses formal hidden-iframe approach)

  // Active Tab Title
  const tabTitles = {
    appointments: 'Appointments Report',
    consultations: 'Consultations Report',
    inventory: 'Inventory & Stock Report',
    symptoms: 'Frequent Symptoms Report',
    chat: 'Live Chat Summary Report',
  }
  const currentTitle = tabTitles[activeTab] || 'Clinic Report'

  // ── Export helpers — delegate to the formal reportExport utility ────
  const exportOptions = () => ({
    activeTab,
    dateFrom,
    dateTo,
    type,
    status,
    serviceId,
    staffId,
    services,
    staffList,
    data: {
      appointments, appSummary, appByDate, appByService,
      consultations, consSummary, consByDate, consByService,
      invSummary, invItems, lowStockItems, expiringBatches,
      invTransactions, invUsageByDate, invByCategory,
      symptomCategories, allSymptomCategories, symptomTotalLogs, symptomConsultations,
      chatData,
    },
    user,
    invSubView,
  })

  const handleExportPDF = () => exportReportToPDF(exportOptions())
  const handleExportCSV = () => exportReportToCSV(exportOptions())


  // Chart data pre-processing for Appointments Status Breakdown
  const appPieData = useMemo(() => {
    return [
      { name: 'Completed', value: appSummary.completed || 0, fill: PIE_COLORS.completed },
      { name: 'Confirmed', value: appSummary.confirmed || 0, fill: PIE_COLORS.confirmed },
      { name: 'Pending',   value: appSummary.pending || 0,   fill: PIE_COLORS.pending },
      { name: 'Cancelled', value: appSummary.cancelled || 0, fill: PIE_COLORS.cancelled },
    ].filter(d => d.value > 0)
  }, [appSummary])

  return (
    <DashboardLayout
      title="Clinic Reports & Analytics"
      subtitle="Detailed, exportable reports for appointments, consultations, inventory, and health trends."
    >


      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* ── Top Bar: Tabs & Action Buttons ─────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          
          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-crust)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
            {[
              { id: 'appointments', label: 'Appointments' },
              { id: 'consultations', label: 'Consultations' },
              { id: 'inventory',     label: 'Inventory' },
              { id: 'symptoms',      label: 'Frequent Symptoms' },
              { id: 'chat',          label: 'Chat Summary' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: '0.45rem 1rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  background: activeTab === tab.id ? 'var(--accent)' : 'transparent',
                  color: activeTab === tab.id ? '#FFFFFF' : 'var(--text-sub)',
                  fontWeight: activeTab === tab.id ? 700 : 500,
                  fontSize: '0.82rem',
                  cursor: 'pointer',
                  transition: 'all var(--transition)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Export Buttons */}
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              id="btn-export-pdf"
              type="button"
              className="btn btn-outline"
              onClick={handleExportPDF}
              style={{ height: '36px', padding: '0 1rem', fontSize: '0.82rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
              title="Export as PDF"
            >
              Export PDF
            </button>
            <button
              id="btn-export-csv"
              type="button"
              className="btn btn-outline"
              onClick={handleExportCSV}
              style={{ height: '36px', padding: '0 1rem', fontSize: '0.82rem', fontWeight: 600, borderRadius: 'var(--radius-sm)' }}
              title="Export raw data to CSV"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* ── Shared Filter Bar ───────────────────────────────────────── */}
        <div className="data-table-wrap report-filter-bar" style={{ padding: '1rem 1.25rem' }}>
          {/* Quick Date Presets */}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.85rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginRight: '0.25rem' }}>
              Date Range:
            </span>
            {PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePreset(p)}
                style={{
                  padding: '0.28rem 0.8rem',
                  borderRadius: 'var(--radius-full)',
                  border: `1.5px solid ${activePreset === p.label ? 'var(--accent)' : 'var(--border)'}`,
                  background: activePreset === p.label ? 'var(--accent)' : 'transparent',
                  color: activePreset === p.label ? '#fff' : 'var(--text-sub)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all var(--transition)',
                }}
              >
                {p.label}
              </button>
            ))}
            <span style={{ marginLeft: 'auto', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              Active Window: <strong>{dateFrom}</strong> to <strong>{dateTo}</strong>
            </span>
          </div>

          {/* Form Filters */}
          <form onSubmit={handleFilterSubmit}>
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
              
              {/* Type filter (Medical / Dental / All) - for Admin */}
              {isAdmin && activeTab !== 'inventory' && (
                <div className="form-group" style={{ marginBottom: 0, minWidth: '130px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                    Type
                  </label>
                  <StyledSelect
                    value={type}
                    onChange={e => setType(e.target.value)}
                  >
                    <option value="all">All Types</option>
                    <option value="medical">Medical</option>
                    <option value="dental">Dental</option>
                  </StyledSelect>
                </div>
              )}

              {/* Status filter (Appointments tab only) */}
              {activeTab === 'appointments' && (
                <div className="form-group" style={{ marginBottom: 0, minWidth: '135px' }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                    Status
                  </label>
                  <StyledSelect
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                  >
                    <option value="all">All Statuses</option>
                    <option value="completed">Completed</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="pending">Pending</option>
                    <option value="cancelled">Cancelled</option>
                  </StyledSelect>
                </div>
              )}

              {/* Service filter */}
              {activeTab !== 'inventory' && (
                <div className="form-group" style={{ marginBottom: 0, minWidth: '160px', flex: 1 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                    Service
                  </label>
                  <StyledSelect
                    value={serviceId}
                    onChange={e => setServiceId(e.target.value)}
                  >
                    <option value="all">All Services</option>
                    {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </StyledSelect>
                </div>
              )}

              {/* Staff filter */}
              {activeTab !== 'inventory' && (
                <div className="form-group" style={{ marginBottom: 0, minWidth: '160px', flex: 1 }}>
                  <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>
                    Attending Staff
                  </label>
                  <StyledSelect
                    value={staffId}
                    onChange={e => setStaffId(e.target.value)}
                  >
                    <option value="all">All Staff</option>
                    {staffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </StyledSelect>
                </div>
              )}

              {/* Date Pickers for Custom range */}
              {(showCustom || activePreset === 'Custom') && (
                <>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: '140px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>From</label>
                    <DateInput
                      label="From"
                      value={dateFrom}
                      onChange={e => setDateFrom(e.target.value)}
                      max={dateTo || undefined}
                      style={{ width: '100%' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: '140px' }}>
                    <label style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>To</label>
                    <DateInput
                      label="To"
                      value={dateTo}
                      onChange={e => setDateTo(e.target.value)}
                      min={dateFrom || undefined}
                      style={{ width: '100%' }}
                    />
                  </div>
                </>
              )}

              {/* Submit */}
              <div style={{ marginBottom: 0 }}>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ height: '40px', padding: '0 1.25rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                >
                  Apply Filters
                </button>
              </div>

            </div>
          </form>
        </div>

        {/* ── TAB 1: APPOINTMENTS ─────────────────────────────────────── */}
        {activeTab === 'appointments' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 2v4M16 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (appSummary.total ?? 0)}</span>
                  <span className="stat-label">Total Bookings</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (appSummary.completed ?? 0)}</span>
                  <span className="stat-label">Completed ({loading ? '—' : (appSummary.completed_pct ?? 0)}%)</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 16 14" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (appSummary.confirmed ?? 0)}</span>
                  <span className="stat-label">Confirmed Upcoming</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (appSummary.cancelled ?? 0)}</span>
                  <span className="stat-label">Cancelled ({loading ? '—' : (appSummary.cancelled_pct ?? 0)}%)</span>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {/* Timeline Chart */}
              <div className="data-table-wrap" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
                  Appointments Over Time
                </h3>
                {loading ? (
                  <div className="table-loading" style={{ height: '220px' }}><div className="loader-ring" /></div>
                ) : appByDate.length === 0 ? (
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No appointment trends recorded in this period.
                  </div>
                ) : (
                  <div style={{ height: '220px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={appByDate} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(v) => {
                          const d = new Date(v); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)' }} />
                        <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Appointments" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Status Breakdown Pie */}
              <div className="data-table-wrap" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
                  Appointment Status Breakdown
                </h3>
                {loading ? (
                  <div className="table-loading" style={{ height: '220px' }}><div className="loader-ring" /></div>
                ) : appPieData.length === 0 ? (
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No status distribution available.
                  </div>
                ) : (
                  <div style={{ height: '220px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={appPieData} cx="50%" cy="50%" innerRadius={55} outerRadius={75} paddingAngle={3} dataKey="value">
                          {appPieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)' }} />
                        <Legend verticalAlign="bottom" height={36} iconSize={8} iconType="circle" />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Data Table */}
            <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
              <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                  Appointment Records ({appointments.length})
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {dateFrom} – {dateTo}
                </span>
              </div>
              {loading ? (
                <div className="table-loading" style={{ minHeight: '180px' }}><div className="loader-ring" /></div>
              ) : appointments.length === 0 ? (
                <div className="empty-state" style={{ padding: '2.5rem', textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-sub)' }}>No appointments found.</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Try selecting a wider date range or clearing filters.
                  </p>
                </div>
              ) : (
                <table className="data-table" style={{ minWidth: '780px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Date &amp; Time</th>
                      <th>Patient</th>
                      <th>Service</th>
                      <th>Staff</th>
                      <th style={{ width: '90px' }}>Type</th>
                      <th style={{ width: '100px' }}>Status</th>
                      <th>Clinical Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appPagination.paginatedItems.map(app => {
                      const consult = app.clinic_record || app.dental_consultation
                      const diagnosis = consult?.diagnosis || '—'
                      const treatment = consult?.treatment || consult?.treatment_performed || '—'
                      const details = diagnosis !== '—' || treatment !== '—'
                        ? [diagnosis !== '—' ? `Dx: ${diagnosis}` : '', treatment !== '—' ? `Tx: ${treatment}` : ''].filter(Boolean).join(' · ')
                        : null
                      const patientUser = app.patient?.user
                      const patientId = patientUser?.student_id || patientUser?.employee_id || null

                      return (
                        <tr key={app.id}>
                          <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                            <div style={{ fontWeight: 600, color: 'var(--text)' }}>
                              {formatAppointmentDate(app)}
                            </div>
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>
                              {formatAppointmentTime(app)}
                            </div>
                          </td>
                          <td className="td-name">
                            <div>{patientUser?.name || 'N/A'}</div>
                            {patientId && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                ID: {patientId}
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{app.service?.name || '—'}</td>
                          <td style={{ fontSize: '0.82rem' }}>{app.staff?.name || '—'}</td>
                          <td>
                            <span className="status-badge" style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>
                              {app.appointment_type || 'General'}
                            </span>
                          </td>
                          <td>
                            <span className={`status-badge ${STATUS_CLS[app.status] || 'role-gold'}`}>
                              {app.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', maxWidth: '240px' }}>
                            <TruncCell text={details} maxLen={55} />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              <Pagination
                currentPage={appPagination.page}
                totalPages={appPagination.totalPages}
                totalItems={appPagination.totalItems}
                pageSize={appPagination.pageSize}
                onPageChange={appPagination.setPage}
                onPageSizeChange={appPagination.setPageSize}
              />
            </div>

          </div>
        )}

        {/* ── TAB 2: CONSULTATIONS ───────────────────────────────────── */}
        {activeTab === 'consultations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (consSummary.total ?? 0)}</span>
                  <span className="stat-label">Total Consultations</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="3" width="20" height="14" rx="2" />
                    <line x1="8" y1="21" x2="16" y2="21" />
                    <line x1="12" y1="17" x2="12" y2="21" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (consSummary.medical_count ?? 0)}</span>
                  <span className="stat-label">Medical Consultations</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2a4 4 0 00-4 4v2a2 2 0 002 2h4a2 2 0 002-2V6a4 4 0 00-4-4z" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (consSummary.dental_count ?? 0)}</span>
                  <span className="stat-label">Dental Consultations</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--amber)', background: 'rgba(245, 158, 11, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (consSummary.student_count ?? 0)}</span>
                  <span className="stat-label">Student Patients</span>
                </div>
              </div>
            </div>

            {/* Chart: Consultations Over Time */}
            <div className="data-table-wrap" style={{ padding: '1.25rem' }}>
              <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
                Consultations Over Time
              </h3>
              {loading ? (
                <div className="table-loading" style={{ height: '220px' }}><div className="loader-ring" /></div>
              ) : consByDate.length === 0 ? (
                <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No consultations recorded in this period.
                </div>
              ) : (
                <div style={{ height: '220px', width: '100%' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={consByDate} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                      <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(v) => {
                        const d = new Date(v); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)' }} />
                      <Bar dataKey="count" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Consultations" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Data Table */}
            <div className="data-table-wrap" style={{ overflowX: 'auto' }}>
              <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text)' }}>
                  Consultation Encounters ({consultations.length})
                </span>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {dateFrom} – {dateTo}
                </span>
              </div>
              {loading ? (
                <div className="table-loading" style={{ minHeight: '180px' }}><div className="loader-ring" /></div>
              ) : consultations.length === 0 ? (
                <div className="empty-state" style={{ padding: '2.5rem', textAlign: 'center' }}>
                  <p style={{ fontWeight: 600, color: 'var(--text-sub)' }}>No consultations found.</p>
                  <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Try selecting a wider date range or clearing filters.
                  </p>
                </div>
              ) : (
                <table className="data-table" style={{ minWidth: '820px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '120px' }}>Date</th>
                      <th>Patient</th>
                      <th style={{ width: '80px' }}>Type</th>
                      <th>Service</th>
                      <th>Attending Staff</th>
                      <th>Complaint / Reason</th>
                      <th>Diagnosis</th>
                      <th>Treatment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consPagination.paginatedItems.map(c => (
                      <tr key={c.id}>
                        <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 600 }}>
                          {c.date}
                        </td>
                        <td className="td-name">
                          <div>{c.patient_name}</div>
                          {c.student_id && c.student_id !== '—' && (
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                              ID: {c.student_id}
                            </div>
                          )}
                        </td>
                        <td>
                          <span className={`status-badge ${c.type === 'dental' ? 'role-green' : 'role-blue'}`} style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}>
                            {c.type}
                          </span>
                        </td>
                        <td style={{ fontSize: '0.82rem' }}>{c.service}</td>
                        <td style={{ fontSize: '0.82rem' }}>{c.attending_staff}</td>
                        <td style={{ fontSize: '0.8rem', maxWidth: '180px' }}>
                          <TruncCell text={c.complaint_diagnosis} maxLen={40} />
                        </td>
                        <td style={{ fontSize: '0.8rem', maxWidth: '180px' }}>
                          <TruncCell text={c.diagnosis} maxLen={40} />
                        </td>
                        <td style={{ fontSize: '0.8rem', maxWidth: '180px' }}>
                          <TruncCell text={c.treatment} maxLen={40} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <Pagination
                currentPage={consPagination.page}
                totalPages={consPagination.totalPages}
                totalItems={consPagination.totalItems}
                pageSize={consPagination.pageSize}
                onPageChange={consPagination.setPage}
                onPageSizeChange={consPagination.setPageSize}
              />
            </div>

          </div>
        )}

        {/* ── TAB 3: INVENTORY ───────────────────────────────────────── */}
        {activeTab === 'inventory' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (invSummary.total_items ?? 0)}</span>
                  <span className="stat-label">Total Catalog Items</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--red)', background: 'rgba(239, 68, 68, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" />
                    <line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (invSummary.low_stock_count ?? 0)}</span>
                  <span className="stat-label">Low / Out of Stock</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--amber)', background: 'rgba(245, 158, 11, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polyline points="12 6 12 12 14 14" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : ((invSummary.expiring_soon_count ?? 0) + (invSummary.expired_count ?? 0))}</span>
                  <span className="stat-label">Expiring / Expired</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9" />
                    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                    <polyline points="7 23 3 19 7 15" />
                    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : (invSummary.total_dispensed ?? 0)}</span>
                  <span className="stat-label">Units Dispensed (Window)</span>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {/* Usage over time */}
              <div className="data-table-wrap" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
                  Usage Trends (Items Dispensed in Date Range)
                </h3>
                {loading ? (
                  <div className="table-loading" style={{ height: '220px' }}><div className="loader-ring" /></div>
                ) : invUsageByDate.length === 0 ? (
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No dispensing activity recorded in this period.
                  </div>
                ) : (
                  <div style={{ height: '220px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={invUsageByDate} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                        <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} tickFormatter={(v) => {
                          const d = new Date(v); return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        }} />
                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)' }} />
                        <Bar dataKey="dispensed" fill="var(--accent)" radius={[4, 4, 0, 0]} name="Units Dispensed" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* Stock by Category */}
              <div className="data-table-wrap" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
                  Stock Volume by Category
                </h3>
                {loading ? (
                  <div className="table-loading" style={{ height: '220px' }}><div className="loader-ring" /></div>
                ) : invByCategory.length === 0 ? (
                  <div style={{ height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No stock data available.
                  </div>
                ) : (
                  <div style={{ height: '220px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={invByCategory} layout="vertical" margin={{ top: 5, right: 20, left: 35, bottom: 5 }}>
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={90} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)' }} />
                        <Bar dataKey="stock" fill="#3B82F6" radius={[0, 4, 4, 0]} name="Total Units" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Inventory Sub-views: Stock Summary | Low Stock | Expiring Batches | Usage Transactions */}
            <div className="data-table-wrap">
              <div style={{ padding: '0.75rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {[
                    { id: 'stock',     label: `Stock Summary (${invItems.length})` },
                    { id: 'low_stock', label: `Low Stock (${lowStockItems.length})` },
                    { id: 'expiring',  label: `Expiring Items (${expiringBatches.length})` },
                    { id: 'usage',     label: `Usage Log (${invTransactions.length})` },
                  ].map(sv => (
                    <button
                      key={sv.id}
                      type="button"
                      onClick={() => setInvSubView(sv.id)}
                      style={{
                        padding: '0.35rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                        background: invSubView === sv.id ? 'var(--accent)' : 'transparent',
                        color: invSubView === sv.id ? '#fff' : 'var(--text-sub)',
                        fontSize: '0.78rem',
                        fontWeight: invSubView === sv.id ? 700 : 500,
                        cursor: 'pointer',
                      }}
                    >
                      {sv.label}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                  Viewing: <strong>{invSubView.replace('_', ' ').toUpperCase()}</strong>
                </span>
              </div>

              {loading ? (
                <div className="table-loading" style={{ minHeight: '180px' }}><div className="loader-ring" /></div>
              ) : invSubView === 'stock' ? (
                /* 1. All Items */
                <>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Item Name</th>
                        <th>Category</th>
                        <th>Current Stock</th>
                        <th>Unit</th>
                        <th>Reorder Level</th>
                        <th>Location</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invStockPagination.paginatedItems.map(item => (
                        <tr key={item.id}>
                          <td className="td-name">{item.name}</td>
                          <td style={{ fontSize: '0.82rem' }}>{item.category}</td>
                          <td style={{ fontWeight: 700, color: item.status === 'out_of_stock' || item.status === 'low_stock' ? 'var(--red)' : 'var(--text)' }}>
                            {item.current_stock ?? '—'}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>{item.unit || 'pcs'}</td>
                          <td style={{ fontSize: '0.82rem' }}>{item.reorder_level}</td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.location}</td>
                          <td>
                            <span className={`status-badge ${item.status === 'out_of_stock' ? 'cancelled' : (item.status === 'low_stock' ? 'role-gold' : 'completed')}`}>
                              {item.status.replace(/_/g, ' ')}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={invStockPagination.page}
                    totalPages={invStockPagination.totalPages}
                    totalItems={invStockPagination.totalItems}
                    pageSize={invStockPagination.pageSize}
                    onPageChange={invStockPagination.setPage}
                    onPageSizeChange={invStockPagination.setPageSize}
                  />
                </>
              ) : invSubView === 'low_stock' ? (
                /* 2. Low Stock Items */
                lowStockItems.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2.5rem', textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-sub)' }}>No low stock items!</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>All items are currently above their reorder thresholds.</p>
                  </div>
                ) : (
                  <>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th>Current Stock</th>
                          <th>Unit</th>
                          <th>Reorder Level</th>
                          <th>Location</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invLowPagination.paginatedItems.map(item => (
                          <tr key={item.id}>
                            <td className="td-name">{item.name}</td>
                            <td style={{ fontSize: '0.82rem' }}>{item.category}</td>
                            <td style={{ fontWeight: 700, color: 'var(--red)' }}>
                              {item.current_stock ?? 0}
                            </td>
                            <td style={{ fontSize: '0.82rem' }}>{item.unit || 'pcs'}</td>
                            <td style={{ fontSize: '0.82rem' }}>{item.reorder_level}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{item.location}</td>
                            <td>
                              <span className="status-badge cancelled">
                                {item.current_stock <= 0 ? 'Out of Stock' : 'Low Stock'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination
                      currentPage={invLowPagination.page}
                      totalPages={invLowPagination.totalPages}
                      totalItems={invLowPagination.totalItems}
                      pageSize={invLowPagination.pageSize}
                      onPageChange={invLowPagination.setPage}
                      onPageSizeChange={invLowPagination.setPageSize}
                    />
                  </>
                )
              ) : invSubView === 'expiring' ? (
                /* 3. Expiring Batches */
                expiringBatches.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2.5rem', textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-sub)' }}>No expiring batches found.</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>All stock batches have more than 30 days of shelf life remaining.</p>
                  </div>
                ) : (
                  <>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Item Name</th>
                          <th>Category</th>
                          <th>Batch No</th>
                          <th>Supplier</th>
                          <th>Expiry Date</th>
                          <th>Remaining Qty</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invExpPagination.paginatedItems.map(b => (
                          <tr key={b.id}>
                            <td className="td-name">{b.item_name}</td>
                            <td style={{ fontSize: '0.82rem' }}>{b.category}</td>
                            <td style={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{b.batch_no}</td>
                            <td style={{ fontSize: '0.82rem' }}>{b.supplier}</td>
                            <td style={{ fontSize: '0.82rem', fontWeight: 600, color: b.is_expired ? 'var(--red)' : 'var(--amber)' }}>
                              {b.expiry_date}
                            </td>
                            <td style={{ fontWeight: 700 }}>{b.remaining}</td>
                            <td>
                              <span className={`status-badge ${b.is_expired ? 'cancelled' : 'role-gold'}`}>
                                {b.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination
                      currentPage={invExpPagination.page}
                      totalPages={invExpPagination.totalPages}
                      totalItems={invExpPagination.totalItems}
                      pageSize={invExpPagination.pageSize}
                      onPageChange={invExpPagination.setPage}
                      onPageSizeChange={invExpPagination.setPageSize}
                    />
                  </>
                )
              ) : (
                /* 4. Usage Transactions */
                invTransactions.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2.5rem', textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-sub)' }}>No usage transactions recorded.</p>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>No inventory items were dispensed or received in this date range.</p>
                  </div>
                ) : (
                  <>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th style={{ width: '110px' }}>Date</th>
                          <th>Item</th>
                          <th>Batch</th>
                          <th>Type</th>
                          <th>Qty</th>
                          <th>Reason / Notes</th>
                          <th>Recorded By</th>
                          <th>Patient</th>
                        </tr>
                      </thead>
                      <tbody>
                        {invTxPagination.paginatedItems.map(t => (
                          <tr key={t.id}>
                            <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{t.transaction_date}</td>
                            <td className="td-name">{t.item_name}</td>
                            <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{t.batch_no}</td>
                            <td>
                              <span className={`status-badge ${t.type === 'IN' ? 'completed' : 'role-blue'}`}>
                                {t.type}
                              </span>
                            </td>
                            <td style={{ fontWeight: 700 }}>{t.quantity}</td>
                            <td style={{ fontSize: '0.8rem' }}>{t.reason}</td>
                            <td style={{ fontSize: '0.8rem' }}>{t.recorded_by}</td>
                            <td style={{ fontSize: '0.8rem' }}>{t.patient_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <Pagination
                      currentPage={invTxPagination.page}
                      totalPages={invTxPagination.totalPages}
                      totalItems={invTxPagination.totalItems}
                      pageSize={invTxPagination.pageSize}
                      onPageChange={invTxPagination.setPage}
                      onPageSizeChange={invTxPagination.setPageSize}
                    />
                  </>
                )
              )}
            </div>

          </div>
        )}

        {/* ── TAB 4: FREQUENT SYMPTOMS ────────────────────────────────── */}
        {activeTab === 'symptoms' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* Stat Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--accent)', background: 'var(--accent-light)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : symptomTotalLogs}</span>
                  <span className="stat-label">Total Symptom Logs</span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--blue)', background: 'rgba(59, 130, 246, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value" style={{ fontSize: '1.1rem' }}>
                    {loading ? '—' : (allSymptomCategories[0]?.name || 'None')}
                  </span>
                  <span className="stat-label">
                    Top Complaint ({loading ? '—' : `${allSymptomCategories[0]?.count || 0} cases`})
                  </span>
                </div>
              </div>

              <div className="stat-card">
                <div className="stat-icon-badge" style={{ color: 'var(--green)', background: 'rgba(34, 197, 94, 0.12)' }}>
                  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <line x1="16" y1="13" x2="8" y2="13" />
                    <line x1="16" y1="17" x2="8" y2="17" />
                  </svg>
                </div>
                <div className="stat-info">
                  <span className="stat-value">{loading ? '—' : allSymptomCategories.length}</span>
                  <span className="stat-label">Distinct Categories</span>
                </div>
              </div>
            </div>

            {/* Charts Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}>
              {/* Pie Distribution with Exact Count and Percentage */}
              <div className="data-table-wrap" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
                  Symptom Distribution (Top Categories)
                </h3>
                {loading ? (
                  <div className="table-loading" style={{ height: '240px' }}><div className="loader-ring" /></div>
                ) : symptomCategories.length === 0 ? (
                  <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No symptoms recorded in this period.
                  </div>
                ) : (
                  <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={symptomCategories.filter(d => d.count > 0)}
                          dataKey="count"
                          nameKey="name"
                          cx="50%"
                          cy="45%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={3}
                        >
                          {symptomCategories.map((entry, index) => {
                            const color = entry.name === 'Others'
                              ? '#CBD5E1'
                              : BLUE_TINTS[index % (BLUE_TINTS.length - 1)]
                            return <Cell key={`cell-${index}`} fill={color} />
                          })}
                        </Pie>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const item = payload[0]
                              const count = item.payload?.count ?? item.value ?? 0
                              const pct = item.payload?.percentage ?? 0
                              return (
                                <div style={{ background: '#FFFFFF', border: '1px solid #CBD5E1', borderRadius: 6, padding: '6px 12px', fontSize: '0.78rem', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}>
                                  <div style={{ fontWeight: 600, color: '#0F172A' }}>{item.name}</div>
                                  <div style={{ color: '#2563EB', fontWeight: 700, marginTop: 2 }}>
                                    {count} record{count === 1 ? '' : 's'} ({pct}%)
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

              {/* Volume Bar Chart */}
              <div className="data-table-wrap" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', fontWeight: 700, color: 'var(--text)' }}>
                  Case Frequency by Symptom
                </h3>
                {loading ? (
                  <div className="table-loading" style={{ height: '240px' }}><div className="loader-ring" /></div>
                ) : allSymptomCategories.length === 0 ? (
                  <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    No case volume data available.
                  </div>
                ) : (
                  <div style={{ height: '240px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={allSymptomCategories} layout="vertical" margin={{ top: 5, right: 20, left: 35, bottom: 5 }}>
                        <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} allowDecimals={false} />
                        <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} width={95} />
                        <Tooltip cursor={{ fill: 'rgba(0,0,0,0.03)' }} contentStyle={{ borderRadius: '6px', border: '1px solid var(--border)' }} />
                        <Bar dataKey="count" fill="var(--accent)" radius={[0, 4, 4, 0]} name="Cases" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            </div>

            {/* Data Tables */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '1.25rem' }}>
              
              {/* Category Breakdown Table */}
              <div className="data-table-wrap">
                <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                    Ranked Categories Summary
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {allSymptomCategories.length} categories
                  </span>
                </div>
                {allSymptomCategories.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-sub)' }}>No symptoms data.</p>
                  </div>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th style={{ width: '60px' }}>Rank</th>
                        <th>Category</th>
                        <th style={{ textAlign: 'right' }}>Cases</th>
                        <th style={{ textAlign: 'right', width: '90px' }}>Share</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allSymptomCategories.map((c, i) => (
                        <tr key={c.name}>
                          <td style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.8rem' }}>#{i + 1}</td>
                          <td className="td-name">{c.name}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--accent)' }}>{c.count}</td>
                          <td style={{ textAlign: 'right', fontSize: '0.82rem' }}>{c.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Consultation Encounters Table */}
              <div className="data-table-wrap">
                <div style={{ padding: '0.85rem 1.25rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text)' }}>
                    Encounter Logs ({symptomConsultations.length})
                  </span>
                  <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                    {dateFrom} – {dateTo}
                  </span>
                </div>
                {symptomConsultations.length === 0 ? (
                  <div className="empty-state" style={{ padding: '2rem', textAlign: 'center' }}>
                    <p style={{ fontWeight: 600, color: 'var(--text-sub)' }}>No encounter logs.</p>
                  </div>
                ) : (
                  <>
                    <div style={{ maxHeight: '340px', overflowY: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Patient</th>
                            <th>Category</th>
                            <th>Chief Complaint</th>
                            <th>Staff</th>
                          </tr>
                        </thead>
                        <tbody>
                          {symptomPagination.paginatedItems.map(s => (
                            <tr key={s.id}>
                              <td style={{ fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{s.date}</td>
                              <td className="td-name">
                                <div>{s.patient_name}</div>
                              </td>
                              <td>
                                <span className="status-badge role-blue" style={{ fontSize: '0.72rem' }}>
                                  {s.category}
                                </span>
                              </td>
                              <td style={{ fontSize: '0.78rem' }}>
                                <TruncCell text={s.chief_complaint} maxLen={35} />
                              </td>
                              <td style={{ fontSize: '0.78rem' }}>{s.attending_staff}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <Pagination
                      currentPage={symptomPagination.page}
                      totalPages={symptomPagination.totalPages}
                      totalItems={symptomPagination.totalItems}
                      pageSize={symptomPagination.pageSize}
                      onPageChange={symptomPagination.setPage}
                      onPageSizeChange={symptomPagination.setPageSize}
                    />
                  </>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            TAB 5: CHAT SUMMARY REPORT
            ══════════════════════════════════════════════════════════════ */}
        {activeTab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* Stat Cards Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '1rem',
              }}
            >
              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Inquiries
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text)', marginTop: '0.35rem' }}>
                  {loading ? '—' : chatData.total_conversations}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  All student chat sessions
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Resolved Inquiries
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: '#16a34a', marginTop: '0.35rem' }}>
                  {loading ? '—' : chatData.resolved_conversations}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Completed student inquiries
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Active Inquiries
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--accent)', marginTop: '0.35rem' }}>
                  {loading ? '—' : chatData.open_conversations}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Awaiting or ongoing response
                </div>
              </div>

              <div className="card" style={{ padding: '1.25rem' }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-sub)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Avg Response Time
                </div>
                <div style={{ fontSize: '1.85rem', fontWeight: 700, color: 'var(--text)', marginTop: '0.35rem' }}>
                  {loading ? '—' : `${chatData.avg_response_time_minutes}m`}
                </div>
                <div style={{ fontSize: '0.75rem', color: chatData.unanswered_24h > 0 ? '#dc2626' : 'var(--text-muted)', marginTop: '0.2rem' }}>
                  {chatData.unanswered_24h > 0 ? `${chatData.unanswered_24h} unanswered (>24h)` : 'Time to first staff reply'}
                </div>
              </div>
            </div>

            {/* Conversation List Table */}
            <div className="card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                    Inquiry History
                  </h3>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    Conversations initiated by students during selected date range
                  </div>
                </div>
              </div>

              {loading ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                  Loading chat report...
                </div>
              ) : (chatData.conversations || []).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No chat conversations found for the selected filters.
                </div>
              ) : (
                <div className="table-responsive">
                  <table className="data-table" style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th>Student Name</th>
                        <th>Student ID</th>
                        <th>Clinic Service</th>
                        <th>Status</th>
                        <th>Started At</th>
                        <th>Last Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {chatPagination.paginatedItems.map(c => (
                        <tr key={c.id}>
                          <td className="td-name">
                            <span style={{ fontWeight: 600 }}>{c.student_name}</span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                            {c.student_id}
                          </td>
                          <td>
                            <span
                              className={`status-badge ${c.role === 'dentist' ? 'role-teal' : 'role-purple'}`}
                              style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}
                            >
                              {c.role === 'dentist' ? 'Dental' : 'Medical'}
                            </span>
                          </td>
                          <td>
                            <span
                              className={`status-badge ${c.status === 'resolved' ? 'completed' : 'role-blue'}`}
                              style={{ fontSize: '0.72rem', textTransform: 'capitalize' }}
                            >
                              {c.status}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
                            {c.created_at || '—'}
                          </td>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
                            {c.last_message_at || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <Pagination
                    currentPage={chatPagination.page}
                    totalPages={chatPagination.totalPages}
                    totalItems={chatPagination.totalItems}
                    pageSize={chatPagination.pageSize}
                    onPageChange={chatPagination.setPage}
                    onPageSizeChange={chatPagination.setPageSize}
                  />
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  )
}
