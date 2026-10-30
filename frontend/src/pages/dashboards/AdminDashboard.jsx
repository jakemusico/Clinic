import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import CalendarWidget from '../../components/CalendarWidget'
import { dashboardApi } from '../../api/dashboard'
import PeriodFilter from '../../components/dashboard/PeriodFilter'
import VisitTrendsChart from '../../components/dashboard/VisitTrendsChart'
import FrequentSymptomsChart from '../../components/dashboard/FrequentSymptomsChart'
import RecentVisitsTable from '../../components/dashboard/RecentVisitsTable'
import InventoryAlertBanner from '../../components/dashboard/InventoryAlertBanner'

export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  // Shared period filter state
  const today = new Date()
  const [period, setPeriod] = useState('monthly') // 'daily' | 'monthly' | 'yearly'
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [year, setYear] = useState(today.getFullYear())

  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true)
      const res = await dashboardApi.admin({ period, month, year })
      setData(res.data)
    } catch (err) {
      console.error('Failed to load admin dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [period, month, year])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const stats = data?.stats || {}
  const chartData = data?.charts || {}

  // 5 Stat cards at the top
  const statCards = [
    { value: loading ? '—' : stats.today_appointments ?? 0, label: "Today's Appointments", icon: 'appointments' },
    { value: loading ? '—' : stats.consultations_today ?? 0, label: 'Consultations Today', icon: 'records' },
    { value: loading ? '—' : stats.registered_students ?? 0, label: 'Registered Students', icon: 'users' },
    { value: loading ? '—' : stats.inventory_alerts ?? 0, label: 'Inventory Alerts', icon: 'inventory' },
    { value: loading ? '—' : stats.unanswered_conversations ?? 0, label: 'Unanswered Conversations', icon: 'chatbot', to: '/chatbot/support?tab=stats' },
  ]

  return (
    <DashboardLayout
      title="Admin Dashboard"
      subtitle="Clinic-wide consultations, health symptoms trends, and patient visits."
      stats={statCards}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', width: '100%' }}>
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
            <div className="dash-grid-2col">
              <VisitTrendsChart
                data={chartData.visit_trends || []}
                loading={loading}
                period={period}
              />
              <FrequentSymptomsChart
                data={chartData.frequent_symptoms || []}
                loading={loading}
              />
            </div>
          </div>

          {/* Right of Charts: Calendar Widget */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <CalendarWidget userRole="admin" />
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
