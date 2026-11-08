import { lazy, Suspense, useEffect, useState, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import { dashboardApi } from '../../api/dashboard'
import PeriodFilter from '../../components/dashboard/PeriodFilter'
import RecentVisitsTable from '../../components/dashboard/RecentVisitsTable'
import InventoryAlertBanner from '../../components/dashboard/InventoryAlertBanner'
import { EMPTY } from '../../utils/emptyValue'
import { CardFallback, ChartsFallback, LoadError } from '../../components/dashboard/Fallbacks'
import { getApiErrorMessage } from '../../utils/apiError'

// The charts (recharts) and the calendar are the heaviest parts of the page: load them as
// separate chunks so the stat cards and the table can appear first.
const VisitTrendsChart = lazy(() => import('../../components/dashboard/VisitTrendsChart'))
const FrequentSymptomsChart = lazy(() => import('../../components/dashboard/FrequentSymptomsChart'))
const CalendarWidget = lazy(() => import('../../components/CalendarWidget'))

export default function ClinicStaffDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Shared period filter state
  const today = new Date()
  const [period, setPeriod] = useState('monthly') // 'daily' | 'monthly' | 'yearly'
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const res = await dashboardApi.nurse({ period, month, year })
      setData(res.data)
    } catch (err) {
      console.error('Failed to load nurse dashboard:', err)
      setError(getApiErrorMessage(err, 'Could not load the dashboard.'))
    } finally {
      setLoading(false)
    }
  }, [period, month, year])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const stats = data?.stats || {}
  const failed = Boolean(error) && !data   // nothing to show: the cards must not read as zeros
  const chartData = data?.charts || {}

  // 4 Stat cards at the top
  const statCards = [
    { value: loading || failed ? EMPTY : stats.my_appointments_today ?? 0, label: "My Appointments Today", icon: 'appointments' },
    { value: loading || failed ? EMPTY : stats.waiting_patients ?? 0, label: 'Waiting Patients', icon: 'schedule' },
    { value: loading || failed ? EMPTY : stats.consultations_completed_today ?? 0, label: 'Consultations Completed Today', icon: 'records' },
    { value: loading || failed ? EMPTY : stats.low_stock_items ?? 0, label: 'Low Stock Items', icon: 'inventory' },
  ]

  return (
    <DashboardLayout
      title="Nurse Dashboard"
      subtitle="Medical consultations, patient symptom analytics, and clinical visits."
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
                <FrequentSymptomsChart
                  data={chartData.frequent_symptoms || []}
                  categorized={chartData.categorized_consultations}
                  total={chartData.total_consultations}
                  loading={loading}
                />
              </div>
            </Suspense>
          </div>

          {/* Right of Charts: Calendar Widget */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <Suspense fallback={<CardFallback />}>
              <CalendarWidget userRole="clinic_staff" events={data?.calendar_events ?? []} />
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
