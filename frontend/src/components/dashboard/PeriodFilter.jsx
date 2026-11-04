import React from 'react'
import Dropdown from '../Dropdown'

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function PeriodFilter({
  period,
  setPeriod,
  month,
  setMonth,
  year,
  setYear,
}) {
  const currentYear = new Date().getFullYear()
  const yearsList = [
    currentYear - 4,
    currentYear - 3,
    currentYear - 2,
    currentYear - 1,
    currentYear,
    currentYear + 1,
  ]

  return (
    <div className="dash-period-toolbar">
      {/* Period mode toggle pills: Daily | Monthly | Yearly */}
      <div className="dash-period-pills">
        <button
          type="button"
          className={`dash-period-pill ${period === 'daily' ? 'active' : ''}`}
          onClick={() => setPeriod('daily')}
        >
          Daily
        </button>
        <button
          type="button"
          className={`dash-period-pill ${period === 'monthly' ? 'active' : ''}`}
          onClick={() => setPeriod('monthly')}
        >
          Monthly
        </button>
        <button
          type="button"
          className={`dash-period-pill ${period === 'yearly' ? 'active' : ''}`}
          onClick={() => setPeriod('yearly')}
        >
          Yearly
        </button>
      </div>

      {/* Date / Month / Year selectors */}
      <div className="dash-period-selectors">
        {period === 'daily' && (
          <Dropdown
            variant="compact"
            value={String(month)}
            onChange={(v) => setMonth(parseInt(v, 10))}
            options={MONTH_NAMES.map((name, idx) => ({ value: String(idx + 1), label: name }))}
            ariaLabel="Select Month"
          />
        )}

        {(period === 'daily' || period === 'monthly') && (
          <Dropdown
            variant="compact"
            value={String(year)}
            onChange={(v) => setYear(parseInt(v, 10))}
            options={yearsList.map((y) => ({ value: String(y), label: String(y) }))}
            ariaLabel="Select Year"
          />
        )}

        {period === 'yearly' && (
          <span className="dash-period-label">
            Last 5 Years ({currentYear - 4} – {currentYear})
          </span>
        )}
      </div>
    </div>
  )
}
