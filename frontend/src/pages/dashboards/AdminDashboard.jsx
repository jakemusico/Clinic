import { lazy, Suspense, useEffect, useState, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { dashboardApi } from '../../api/dashboard'
import PeriodFilter from '../../components/dashboard/PeriodFilter'
import RecentVisitsTable from '../../components/dashboard/RecentVisitsTable'
import InventoryAlertBanner from '../../components/dashboard/InventoryAlertBanner'
import { EMPTY } from '../../utils/emptyValue'
import { CardFallback, ChartsFallback, LoadError } from '../../components/dashboard/Fallbacks'
import { getApiErrorMessage } from '../../utils/apiError'
import useLatestRequest, { isRequestCanceled } from '../../hooks/useLatestRequest'

// The charts (recharts) and the calendar are the heaviest parts of the page: load them as
// separate chunks so the stat cards and the table can appear first.
const VisitTrendsChart = lazy(() => import('../../components/dashboard/VisitTrendsChart'))
const FrequentSymptomsChart = lazy(() => import('../../components/dashboard/FrequentSymptomsBarChart'))
const CalendarWidget = lazy(() => import('../../components/CalendarWidget'))

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Shared period filter state
  const today = new Date()
  const [period, setPeriod] = useState('monthly') // 'daily' | 'monthly' | 'yearly'
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())
  const [symptomType, setSymptomType] = useState('all') // 'all' | 'medical' | 'dental'

  const latest = useLatestRequest()

  const fetchDashboardData = useCallback(async () => {
    const req = latest.begin()   // switching the period quickly: only the newest answer is shown
    try {
      setLoading(true)
      setError('')
      const res = await dashboardApi.admin({ period, month, year, ...(symptomType !== 'all' && { type: symptomType }) }, { signal: req.signal })
      if (!req.isCurrent()) return
      setData(res.data)
    } catch (err) {
      if (isRequestCanceled(err) || !req.isCurrent()) return
      console.error('Failed to load admin dashboard:', err)
      setError(getApiErrorMessage(err, 'Could not load the dashboard.'))
    } finally {
      if (req.isCurrent()) setLoading(false)
    }
  }, [latest, period, month, year, symptomType])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const stats = data?.stats || {}
  const failed = Boolean(error) && !data   // nothing to show: the cards must not read as zeros
  const chartData = data?.charts || {}

  // 5 Stat cards at the top
  const statCards = [
    { value: loading || failed ? EMPTY : stats.today_appointments ?? 0, label: "Today's Appointments", icon: 'appointments' },
    { value: loading || failed ? EMPTY : stats.consultations_today ?? 0, label: 'Consultations Today', icon: 'records' },
    { value: loading || failed ? EMPTY : stats.registered_students ?? 0, label: 'Registered Students', icon: 'users' },
    { value: loading || failed ? EMPTY : stats.inventory_alerts ?? 0, label: 'Inventory Alerts', icon: 'inventory' },
    { value: loading || failed ? EMPTY : stats.unanswered_conversations ?? 0, label: 'Unanswered Conversations', icon: 'chatbot', to: '/chatbot/support?tab=stats' },
  ]

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle="Clinic-wide consultations, health symptoms trends, and patient visits."
      stats={statCards}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
        {error && !loading && <LoadError message={error} onRetry={fetchDashboardData} />}

        {/* Inventory Alert Banner */}
        <InventoryAlertBanner alert={data?.inventory_alert} />

        {/* Main Grid: Left (PeriodFilter + Charts) / Right (Calendar) */}
        <div className="dashboard-main-grid">
          {/* Left of Calendar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem', minWidth: 0 }}>
            {/* Shared period filter for both charts */}
            <PeriodFilter
              period={period}
              setPeriod={setPeriod}
              month={month}
              setMonth={setMonth}
              year={year}
              setYear={setYear}
            />

            {/* Equal-height charts row */}
            <Suspense fallback={<ChartsFallback />}>
              <div className="dash-grid-2col">
                <VisitTrendsChart
                  data={chartData.visit_trends || []}
                  loading={loading}
                  period={period}
                />
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-end', marginBottom: '0.4rem' }}>
                    {[['all', 'All'], ['medical', 'Medical'], ['dental', 'Dental']].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setSymptomType(value)}
                        style={{
                          padding: '0.22rem 0.7rem',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          borderRadius: 999,
                          border: `1px solid ${symptomType === value ? 'var(--accent)' : 'var(--border)'}`,
                          background: symptomType === value ? 'var(--accent)' : '#FFFFFF',
                          color: symptomType === value ? '#FFFFFF' : 'var(--text-muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <FrequentSymptomsChart
                    data={chartData.frequent_symptoms || []}
                    loading={loading}
                  />
                </div>
              </div>
            </Suspense>
          </div>

          {/* Right of Charts: Calendar Widget */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Suspense fallback={<CardFallback />}>
              <CalendarWidget userRole="admin" events={data?.calendar_events ?? []} />
            </Suspense>
          </div>
        </div>

        {/* Below the charts, full width: Recent Visits Table (Latest 8 rows) */}
        <div style={{ width: '100%', paddingBottom: '1rem' }}>
          <RecentVisitsTable
            visits={data?.recent_visits || []}
            loading={loading}
            viewAllLink="/clinic/consultations"
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
