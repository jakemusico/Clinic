import React from 'react'

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
          <select
            className="dash-period-select"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            aria-label="Select Month"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>
                {name}
              </option>
            ))}
          </select>
        )}

        {(period === 'daily' || period === 'monthly') && (
          <select
            className="dash-period-select"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            aria-label="Select Year"
          >
            {yearsList.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
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
