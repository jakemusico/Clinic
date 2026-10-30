import { useEffect, useState, useCallback } from 'react'
import DashboardLayout from '../../components/DashboardLayout'
import CalendarWidget from '../../components/CalendarWidget'
import { dashboardApi } from '../../api/dashboard'
import PeriodFilter from '../../components/dashboard/PeriodFilter'
import VisitTrendsChart from '../../components/dashboard/VisitTrendsChart'
import FrequentSymptomsChart from '../../components/dashboard/FrequentSymptomsChart'
import RecentVisitsTable from '../../components/dashboard/RecentVisitsTable'
import InventoryAlertBanner from '../../components/dashboard/InventoryAlertBanner'

export default function DentistDashboard() {
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
      const res = await dashboardApi.dentist({ period, month, year })
      setData(res.data)
    } catch (err) {
      console.error('Failed to load dentist dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [period, month, year])

  useEffect(() => {
    fetchDashboardData()
  }, [fetchDashboardData])

  const stats = data?.stats || {}
  const chartData = data?.charts || {}

  // 4 Stat cards at the top
  const statCards = [
    { value: loading ? '—' : stats.my_dental_appointments_today ?? 0, label: "My Dental Appointments Today", icon: 'appointments' },
    { value: loading ? '—' : stats.waiting_patients ?? 0, label: 'Waiting Patients', icon: 'schedule' },
    { value: loading ? '—' : stats.dental_consultations_completed_today ?? 0, label: 'Dental Consultations Completed Today', icon: 'dentalChart' },
    { value: loading ? '—' : stats.dental_supplies_low_stock ?? 0, label: 'Dental Supplies Low Stock', icon: 'inventory' },
  ]

  return (
    <DashboardLayout
      title="Dentist Dashboard"
      subtitle="Dental consultations, patient symptoms analytics, and oral health visits."
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
            <CalendarWidget userRole="dentist" />
          </div>
        </div>

        {/* Below the charts, full width: Recent Visits Table (Latest 8 rows) */}
        <div style={{ width: '100%', paddingBottom: '1rem' }}>
          <RecentVisitsTable
            visits={data?.recent_visits || []}
            loading={loading}
            viewAllLink="/dental/consultations"
          />
        </div>
      </div>
    </DashboardLayout>
  )
}
