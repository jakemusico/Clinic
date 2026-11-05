/**
 * Formal Print-Ready PDF and CSV Exporter for Admin > Reports
 * Conforms to strict A4 margins, typography, repeating headers, and ISO CSV standards.
 */

import { toast } from 'react-hot-toast'
import { reportsApi } from '../api/reports'
import { EMPTY, NO_SERVICE } from './emptyValue'
import { toDateKey, toDateTimeKey } from './dateUtils'

// Absolute URL so the logo loads correctly inside the hidden print iframe
const LOGO_PATH = `${window.location.origin}/fsuu_logo.png`

// Helper for formatting ISO dates
const toISODate = (val) => {
  if (!val) return EMPTY
  return toDateKey(val) || String(val)
}

const toISODateTime = (val) => {
  if (!val) return EMPTY
  return toDateTimeKey(val) || String(val)
}

const formatDisplayDate = (dStr) => {
  if (!dStr) return EMPTY
  const d = new Date(dStr + (dStr.length === 10 ? 'T00:00:00' : ''))
  if (isNaN(d.getTime())) return dStr
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

/**
 * Generate an inline vector SVG chart (primary blue & grays, crisp print vector)
 */
function generateSVGChart(tab, data, width = 680, height = 120) {
  if (tab === 'appointments' || tab === 'consultations') {
    const trend = (tab === 'appointments' ? data.appByDate : data.consByDate) || []
    if (trend.length === 0) return ''
    const slice = trend.slice(-14) // latest 14 data points
    const maxVal = Math.max(...slice.map(d => d.count || 0), 1)
    const padding = 25
    const chartW = width - padding * 2
    const chartH = height - 35
    const barW = Math.max(8, Math.min(28, (chartW / slice.length) - 6))

    const bars = slice.map((item, idx) => {
      const x = padding + idx * (chartW / slice.length) + (chartW / slice.length - barW) / 2
      const barHeight = ((item.count || 0) / maxVal) * chartH
      const y = height - 20 - barHeight
      const label = item.date ? item.date.slice(5) : '' // MM-DD
      return `
        <g>
          <rect x="${x}" y="${y}" width="${barW}" height="${barHeight}" fill="#2563EB" rx="2" />
          <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle" font-size="8.5" fill="#1E293B" font-weight="bold">${item.count}</text>
          <text x="${x + barW / 2}" y="${height - 6}" text-anchor="middle" font-size="8" fill="#64748B">${label}</text>
        </g>
      `
    }).join('')

    return `
      <div class="report-chart-box">
        <div class="chart-caption">${tab === 'appointments' ? 'Appointment Volume Over Time' : 'Consultation Encounters Over Time'}</div>
        <svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" style="overflow: visible;">
          <line x1="${padding}" y1="${height - 20}" x2="${width - padding}" y2="${height - 20}" stroke="#CBD5E1" stroke-width="1" />
          ${bars}
        </svg>
      </div>
    `
  }

  if (tab === 'inventory') {
    const categories = (data.invByCategory || []).slice(0, 5)
    if (categories.length === 0) return ''
    const maxStock = Math.max(...categories.map(c => c.stock || 0), 1)
    const rowH = 18
    const totalH = categories.length * (rowH + 6) + 20

    const rows = categories.map((cat, idx) => {
      const y = idx * (rowH + 6) + 10
      const barW = Math.max(4, ((cat.stock || 0) / maxStock) * (width - 170))
      return `
        <g>
          <text x="5" y="${y + 13}" font-size="9" fill="#1E293B" font-weight="500">${cat.name}</text>
          <rect x="110" y="${y + 2}" width="${barW}" height="${rowH}" fill="#2563EB" rx="2" />
          <text x="${110 + barW + 8}" y="${y + 14}" font-size="8.5" fill="#1E293B" font-weight="bold">${cat.stock} units</text>
        </g>
      `
    }).join('')

    return `
      <div class="report-chart-box">
        <div class="chart-caption">Stock Volume by Category</div>
        <svg width="100%" height="${totalH}" viewBox="0 0 ${width} ${totalH}">
          ${rows}
        </svg>
      </div>
    `
  }

  if (tab === 'symptoms') {
    const categories = (data.symptomCategories || []).slice(0, 5)
    if (categories.length === 0) return ''
    const maxVal = Math.max(...categories.map(c => c.count || 0), 1)
    const rowH = 18
    const totalH = categories.length * (rowH + 6) + 20

    const rows = categories.map((cat, idx) => {
      const y = idx * (rowH + 6) + 10
      const barW = Math.max(4, ((cat.count || 0) / maxVal) * (width - 180))
      return `
        <g>
          <text x="5" y="${y + 13}" font-size="9" fill="#1E293B" font-weight="500">${cat.name}</text>
          <rect x="120" y="${y + 2}" width="${barW}" height="${rowH}" fill="#2563EB" rx="2" />
          <text x="${120 + barW + 8}" y="${y + 14}" font-size="8.5" fill="#1E293B" font-weight="bold">${cat.count} (${cat.percentage}%)</text>
        </g>
      `
    }).join('')

    return `
      <div class="report-chart-box">
        <div class="chart-caption">Top Frequent Symptoms / Complaints Distribution</div>
        <svg width="100%" height="${totalH}" viewBox="0 0 ${width} ${totalH}">
          ${rows}
        </svg>
      </div>
    `
  }

  return ''
}

/**
 * Build the complete, self-contained HTML for formal A4 printing
 */
export function buildReportHTML(options) {
  const {
    activeTab,
    dateFrom,
    dateTo,
    type = 'all',
    status = 'all',
    serviceId = 'all',
    staffId = 'all',
    services = [],
    staffList = [],
    data = {},
    user = {},
    invSubView = 'stock',
  } = options

  const tabTitles = {
    appointments: 'Appointments Report',
    consultations: 'Consultations Report',
    inventory: 'Inventory & Stock Report',
    symptoms: 'Frequent Symptoms Report',
  }
  const reportTitle = tabTitles[activeTab] || 'Clinic Report'

  // More than 6 columns triggers Landscape orientation (Requirement 4)
  const isLandscape = activeTab === 'appointments' || activeTab === 'consultations' || activeTab === 'inventory' || (activeTab === 'symptoms' && (data.symptomConsultations || []).length > 0)
  const orientation = isLandscape ? 'landscape' : 'portrait'

  const serviceName = serviceId === 'all' ? 'All Services' : (services.find(s => String(s.id) === String(serviceId))?.name || 'All Services')
  const staffName   = staffId === 'all' ? 'All Staff' : (staffList.find(s => String(s.id) === String(staffId))?.name || 'All Staff')
  const statusLabel = status === 'all' ? 'All Statuses' : status.toUpperCase()
  const typeLabel   = type === 'all' ? 'All Types' : type.toUpperCase()

  const genDate = new Date().toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const userName = user?.name || 'Staff'
  const userRole = user?.role === 'admin' ? 'Clinic Administrator' : (user?.role === 'dentist' ? 'Dental Staff' : 'Clinic Nurse')

  // ── Build Summary Table Block ──────────────────────────────────────
  let summaryRows = ''
  if (activeTab === 'appointments') {
    const s = data.appSummary || {}
    summaryRows = `
      <tr>
        <td><strong>Total Bookings:</strong> ${s.total ?? 0}</td>
        <td><strong>Completed:</strong> ${s.completed ?? 0} (${s.completed_pct ?? 0}%)</td>
        <td><strong>Confirmed:</strong> ${s.confirmed ?? 0}</td>
        <td><strong>Pending:</strong> ${s.pending ?? 0}</td>
        <td><strong>Cancelled:</strong> ${s.cancelled ?? 0} (${s.cancelled_pct ?? 0}%)</td>
      </tr>
    `
  } else if (activeTab === 'consultations') {
    const s = data.consSummary || {}
    summaryRows = `
      <tr>
        <td><strong>Total Consultations:</strong> ${s.total ?? 0}</td>
        <td><strong>Medical Encounters:</strong> ${s.medical_count ?? 0}</td>
        <td><strong>Dental Encounters:</strong> ${s.dental_count ?? 0}</td>
        <td><strong>Student Patients:</strong> ${s.student_count ?? 0}</td>
        <td><strong>Faculty & Staff:</strong> ${s.staff_count ?? 0}</td>
      </tr>
    `
  } else if (activeTab === 'inventory') {
    const s = data.invSummary || {}
    summaryRows = `
      <tr>
        <td><strong>Total Items:</strong> ${s.total_items ?? 0}</td>
        <td><strong>Total Units in Stock:</strong> ${s.total_stock ?? 0}</td>
        <td><strong>Low / Out of Stock:</strong> ${s.low_stock_count ?? 0}</td>
        <td><strong>Expiring / Expired:</strong> ${(s.expiring_soon_count ?? 0) + (s.expired_count ?? 0)}</td>
        <td><strong>Units Dispensed:</strong> ${s.total_dispensed ?? 0}</td>
      </tr>
    `
  } else if (activeTab === 'symptoms') {
    const topCat = (data.allSymptomCategories || [])[0]
    summaryRows = `
      <tr>
        <td><strong>Total Logs:</strong> ${data.symptomTotalLogs ?? 0}</td>
        <td><strong>Top Reported:</strong> ${topCat ? `${topCat.name} (${topCat.count} cases)` : 'None'}</td>
        <td><strong>Distinct Categories:</strong> ${(data.allSymptomCategories || []).length}</td>
        <td colspan="2"><strong>Reporting Window:</strong> ${dateFrom} to ${dateTo}</td>
      </tr>
    `
  }

  // ── Build One Chart (SVG, primary blue & grays) ────────────────────
  const chartHtml = generateSVGChart(activeTab, data, isLandscape ? 960 : 680, 110)

  // ── Build Data Table ───────────────────────────────────────────────
  let theadHtml = ''
  let tbodyHtml = ''

  if (activeTab === 'appointments') {
    const list = data.appointments || []
    theadHtml = `
      <tr>
        <th style="width: 14%;">Date &amp; Time</th>
        <th style="width: 18%;">Patient</th>
        <th style="width: 10%;">Student ID</th>
        <th style="width: 14%;">Service</th>
        <th style="width: 13%;">Attending Staff</th>
        <th style="width: 8%;">Type</th>
        <th style="width: 9%;">Status</th>
        <th style="width: 14%;">Diagnosis &amp; Treatment</th>
      </tr>
    `
    if (list.length === 0) {
      tbodyHtml = `<tr><td colspan="8" class="no-records">No records found for the selected reporting period and filters.</td></tr>`
    } else {
      tbodyHtml = list.map(app => {
        const u = app.patient?.user
        const consult = app.clinic_record || app.dental_consultation
        const details = [consult?.diagnosis ? `Dx: ${consult.diagnosis}` : '', (consult?.treatment || consult?.treatment_performed) ? `Tx: ${consult.treatment || consult.treatment_performed}` : ''].filter(Boolean).join(' · ') || EMPTY
        return `
          <tr>
            <td>${toISODateTime(app.scheduled_at)}</td>
            <td><strong>${u?.name || 'N/A'}</strong></td>
            <td>${u?.student_id || u?.employee_id || EMPTY}</td>
            <td>${app.service?.name || EMPTY}</td>
            <td>${app.staff?.name || EMPTY}</td>
            <td style="text-transform: capitalize;">${app.appointment_type || 'General'}</td>
            <td><strong>${(app.status || 'pending').toUpperCase()}</strong></td>
            <td>${details}</td>
          </tr>
        `
      }).join('')
    }
  } else if (activeTab === 'consultations') {
    const list = data.consultations || []
    theadHtml = `
      <tr>
        <th style="width: 11%;">Date</th>
        <th style="width: 17%;">Patient</th>
        <th style="width: 10%;">ID No</th>
        <th style="width: 8%;">Type</th>
        <th style="width: 14%;">Service</th>
        <th style="width: 13%;">Attending Staff</th>
        <th style="width: 13%;">Complaint Category</th>
        <th style="width: 14%;">Diagnosis &amp; Treatment</th>
      </tr>
    `
    if (list.length === 0) {
      tbodyHtml = `<tr><td colspan="8" class="no-records">No records found for the selected reporting period and filters.</td></tr>`
    } else {
      tbodyHtml = list.map(c => {
        const diagTx = [c.diagnosis !== EMPTY ? c.diagnosis : '', c.treatment !== EMPTY ? c.treatment : ''].filter(Boolean).join(' · ') || EMPTY
        return `
          <tr>
            <td>${c.raw_date || c.date}</td>
            <td><strong>${c.patient_name}</strong></td>
            <td>${c.student_id || EMPTY}</td>
            <td style="text-transform: capitalize;">${c.type}</td>
            <td>${c.service || NO_SERVICE}</td>
            <td>${c.attending_staff}</td>
            <td>${c.complaint_category || c.complaint_diagnosis}</td>
            <td>${diagTx}</td>
          </tr>
        `
      }).join('')
    }
  } else if (activeTab === 'inventory') {
    if (invSubView === 'usage') {
      const list = data.invTransactions || []
      theadHtml = `
        <tr>
          <th style="width: 11%;">Date</th>
          <th style="width: 20%;">Item Name</th>
          <th style="width: 13%;">Category</th>
          <th style="width: 12%;">Batch No</th>
          <th style="width: 8%;">Type</th>
          <th style="width: 9%;" class="text-right">Qty</th>
          <th style="width: 14%;">Reason / Notes</th>
          <th style="width: 13%;">Recorded By</th>
        </tr>
      `
      if (list.length === 0) {
        tbodyHtml = `<tr><td colspan="8" class="no-records">No records found for the selected reporting period and filters.</td></tr>`
      } else {
        tbodyHtml = list.map(t => `
          <tr>
            <td>${t.raw_date || t.transaction_date}</td>
            <td><strong>${t.item_name}</strong></td>
            <td>${t.category}</td>
            <td style="font-family: monospace;">${t.batch_no}</td>
            <td><strong>${t.type}</strong></td>
            <td class="text-right"><strong>${t.quantity}</strong></td>
            <td>${t.reason}</td>
            <td>${t.recorded_by}</td>
          </tr>
        `).join('')
      }
    } else if (invSubView === 'expiring') {
      const list = data.expiringBatches || []
      theadHtml = `
        <tr>
          <th style="width: 22%;">Item Name</th>
          <th style="width: 15%;">Category</th>
          <th style="width: 14%;">Batch No</th>
          <th style="width: 16%;">Supplier</th>
          <th style="width: 12%;">Expiry Date</th>
          <th style="width: 10%;" class="text-right">Remaining</th>
          <th style="width: 11%;">Status</th>
        </tr>
      `
      if (list.length === 0) {
        tbodyHtml = `<tr><td colspan="7" class="no-records">No expiring batches found within 30 days.</td></tr>`
      } else {
        tbodyHtml = list.map(b => `
          <tr>
            <td><strong>${b.item_name}</strong></td>
            <td>${b.category}</td>
            <td style="font-family: monospace;">${b.batch_no}</td>
            <td>${b.supplier}</td>
            <td>${b.expiry_date}</td>
            <td class="text-right"><strong>${b.remaining}</strong></td>
            <td><strong>${b.status}</strong></td>
          </tr>
        `).join('')
      }
    } else {
      const list = (invSubView === 'low_stock' ? data.lowStockItems : data.invItems) || []
      theadHtml = `
        <tr>
          <th style="width: 26%;">Item Name</th>
          <th style="width: 18%;">Category</th>
          <th style="width: 12%;" class="text-right">Current Stock</th>
          <th style="width: 10%;">Unit</th>
          <th style="width: 12%;" class="text-right">Reorder Level</th>
          <th style="width: 12%;">Location</th>
          <th style="width: 10%;">Status</th>
        </tr>
      `
      if (list.length === 0) {
        tbodyHtml = `<tr><td colspan="7" class="no-records">No records found.</td></tr>`
      } else {
        tbodyHtml = list.map(item => `
          <tr>
            <td><strong>${item.name}</strong></td>
            <td>${item.category}</td>
            <td class="text-right"><strong>${item.current_stock ?? EMPTY}</strong></td>
            <td>${item.unit || 'pcs'}</td>
            <td class="text-right">${item.reorder_level}</td>
            <td>${item.location}</td>
            <td>${item.status.replace(/_/g, ' ').toUpperCase()}</td>
          </tr>
        `).join('')
      }
    }
  } else if (activeTab === 'symptoms') {
    const list = data.allSymptomCategories || []
    theadHtml = `
      <tr>
        <th style="width: 12%;">Rank</th>
        <th style="width: 48%;">Symptom / Complaint Category</th>
        <th style="width: 20%;" class="text-right">Logged Cases</th>
        <th style="width: 20%;" class="text-right">Proportion</th>
      </tr>
    `
    if (list.length === 0) {
      tbodyHtml = `<tr><td colspan="4" class="no-records">No symptom logs found for the selected reporting period and filters.</td></tr>`
    } else {
      tbodyHtml = list.map((c, i) => `
        <tr>
          <td><strong>#${i + 1}</strong></td>
          <td><strong>${c.name}</strong></td>
          <td class="text-right"><strong>${c.count}</strong></td>
          <td class="text-right">${c.percentage}%</td>
        </tr>
      `).join('')
    }
  }

  // ── Complete HTML Document ─────────────────────────────────────────
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>FSUU Clinic - ${reportTitle}</title>
  <style>
    @page {
      size: A4 ${orientation};
      margin: 20mm;
      @bottom-left {
        content: "Confidential: contains student health information";
        font-size: 8pt;
        color: #475569;
        font-family: Arial, sans-serif;
      }
      @bottom-center {
        content: "Generated on ${genDate}";
        font-size: 8pt;
        color: #475569;
        font-family: Arial, sans-serif;
      }
      @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 8pt;
        color: #475569;
        font-family: Arial, sans-serif;
      }
    }

    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    body {
      background: #FFFFFF !important;
      color: #000000 !important;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10pt;
      line-height: 1.35;
      margin: 0;
      padding: 0;
    }

    /* 1. Header */
    .header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    .header-logo {
      width: 65px;
      vertical-align: middle;
      text-align: left;
    }
    .header-logo img {
      width: 58px;
      height: 58px;
      object-fit: contain;
    }
    .header-center {
      text-align: center;
      vertical-align: middle;
      padding-right: 65px; /* balance logo on left */
    }
    .header-school {
      font-size: 12.5pt;
      font-weight: bold;
      color: #000000;
      margin: 0;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .header-clinic {
      font-size: 10.5pt;
      font-weight: 600;
      color: #1E293B;
      margin: 2px 0;
    }
    .header-title {
      font-size: 11.5pt;
      font-weight: bold;
      color: #000000;
      margin: 3px 0 1px 0;
      text-transform: uppercase;
    }
    .header-period {
      font-size: 9.5pt;
      color: #334155;
      margin: 0;
    }
    .header-divider {
      border: none;
      border-top: 1.5px solid #000000;
      margin: 8px 0 12px 0;
    }

    /* 2. Info Block */
    .info-table {
      width: 100%;
      border-collapse: collapse;
      background: #F8FAFC;
      border: 1px solid #CBD5E1;
      margin-bottom: 12px;
      font-size: 9pt;
    }
    .info-table td {
      padding: 5px 10px;
      vertical-align: top;
      border-bottom: 1px solid #E2E8F0;
    }
    .info-table tr:last-child td {
      border-bottom: none;
    }
    .info-label {
      color: #475569;
      font-weight: 600;
      width: 16%;
    }
    .info-value {
      color: #0F172A;
      width: 34%;
    }

    /* 3. Summary Table */
    .summary-table {
      width: 100%;
      border-collapse: collapse;
      border: 1px solid #94A3B8;
      margin-bottom: 12px;
      font-size: 9.5pt;
      background: #FFFFFF;
    }
    .summary-table td {
      border: 1px solid #CBD5E1;
      padding: 7px 10px;
      background: #F8FAFC;
    }

    /* 4. Chart Box */
    .report-chart-box {
      border: 1px solid #CBD5E1;
      border-radius: 4px;
      padding: 8px 12px 6px 12px;
      margin-bottom: 14px;
      background: #FFFFFF;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .chart-caption {
      font-size: 9pt;
      font-weight: bold;
      color: #334155;
      margin-bottom: 6px;
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    /* 5. Main Data Table */
    .data-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 4px;
      font-size: 9pt;
    }
    .data-table thead {
      display: table-header-group;
    }
    .data-table th {
      background-color: #334155 !important;
      color: #FFFFFF !important;
      font-weight: bold;
      border: 1px solid #1E293B;
      padding: 6px 7px;
      text-align: left;
      font-size: 8.5pt;
      text-transform: uppercase;
      letter-spacing: 0.02em;
    }
    .data-table td {
      border: 1px solid #CBD5E1;
      padding: 5px 7px;
      vertical-align: top;
      word-break: break-word;
      color: #0F172A;
    }
    .data-table tbody tr:nth-child(even) {
      background-color: #F8FAFC !important;
    }
    .data-table tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .text-right {
      text-align: right !important;
    }
    .no-records {
      text-align: center !important;
      padding: 24px 10px !important;
      color: #64748B !important;
      font-style: italic;
    }

    /* 6. Signature Area */
    .signature-container {
      margin-top: 28px;
      width: 100%;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .signature-table {
      width: 100%;
      border-collapse: collapse;
    }
    .signature-col {
      width: 45%;
      vertical-align: top;
    }
    .signature-gap {
      width: 10%;
    }
    .signature-role-title {
      font-size: 9.5pt;
      margin-bottom: 42px;
      color: #000000;
    }
    .signature-line {
      border-top: 1px solid #000000;
      padding-top: 4px;
      text-align: center;
    }
    .signature-name {
      font-size: 10pt;
      font-weight: bold;
      display: block;
      color: #000000;
    }
    .signature-position {
      font-size: 8.5pt;
      color: #334155;
      display: block;
    }

    /* 7. Footer fallback for non-paged print view */
    .document-footer {
      margin-top: 22px;
      padding-top: 8px;
      border-top: 1px solid #E2E8F0;
      font-size: 8pt;
      color: #64748B;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <table class="header-table">
    <tr>
      <td class="header-logo">
        <img src="${LOGO_PATH}" alt="FSUU Seal" onerror="this.style.display='none'">
      </td>
      <td class="header-center">
        <h1 class="header-school">Fr. Saturnino Urios University</h1>
        <div class="header-clinic">FSUU Clinic · Medical &amp; Dental Health Services</div>
        <div class="header-title">${reportTitle}</div>
        <div class="header-period">Reporting Period: ${formatDisplayDate(dateFrom)} to ${formatDisplayDate(dateTo)}</div>
      </td>
    </tr>
  </table>
  <hr class="header-divider">

  <!-- Info Block -->
  <table class="info-table">
    <tr>
      <td class="info-label">Date Generated:</td>
      <td class="info-value">${genDate}</td>
      <td class="info-label">Reporting Type:</td>
      <td class="info-value">${typeLabel}</td>
    </tr>
    <tr>
      <td class="info-label">Generated By:</td>
      <td class="info-value">${userName} (${userRole})</td>
      <td class="info-label">Status Filter:</td>
      <td class="info-value">${statusLabel}</td>
    </tr>
    <tr>
      <td class="info-label">Clinic Service:</td>
      <td class="info-value">${serviceName}</td>
      <td class="info-label">Attending Staff:</td>
      <td class="info-value">${staffName}</td>
    </tr>
  </table>

  <!-- Summary Table -->
  <table class="summary-table">
    ${summaryRows}
  </table>

  <!-- One Chart At Most -->
  ${chartHtml}

  <!-- Main Data Table -->
  <table class="data-table">
    <thead>
      ${theadHtml}
    </thead>
    <tbody>
      ${tbodyHtml}
    </tbody>
  </table>

  <!-- Signature Area -->
  <div class="signature-container">
    <table class="signature-table">
      <tr>
        <td class="signature-col">
          <div class="signature-role-title">Prepared by:</div>
          <div class="signature-line">
            <span class="signature-name">${userName}</span>
            <span class="signature-position">${userRole}</span>
          </div>
        </td>
        <td class="signature-gap"></td>
        <td class="signature-col">
          <div class="signature-role-title">Noted by:</div>
          <div class="signature-line">
            <span class="signature-name">Clinic Supervisor</span>
            <span class="signature-position">Head, University Health &amp; Medical Services</span>
          </div>
        </td>
      </tr>
    </table>
  </div>

  <!-- Document Footer -->
  <div class="document-footer">
    <span>Confidential: contains student health information</span>
    <span>Generated on ${genDate}</span>
    <span>FSUU Clinic Services</span>
  </div>

</body>
</html>`
}

/**
 * Trigger Native Print-to-PDF with the formal HTML
 */
export async function exportReportToPDF(options) {
  const { activeTab, dateFrom, dateTo, type, status, serviceId, staffId } = options

  // 1. Audit log
  try {
    await reportsApi.logExport({
      report: activeTab,
      format: 'pdf',
      filters: { date_from: dateFrom, date_to: dateTo, type, status, service_id: serviceId, staff_id: staffId },
    })
  } catch (err) {
    console.error('Failed to log PDF export:', err)
  }

  // 2. Build formal HTML
  const html = buildReportHTML(options)

  // 3. Print via hidden iframe (avoids popup blockers and ugly blank tabs)
  let iframe = document.getElementById('fsuu-report-pdf-frame')
  if (!iframe) {
    iframe = document.createElement('iframe')
    iframe.id = 'fsuu-report-pdf-frame'
    iframe.style.position = 'fixed'
    iframe.style.right = '0'
    iframe.style.bottom = '0'
    iframe.style.width = '0'
    iframe.style.height = '0'
    iframe.style.border = '0'
    document.body.appendChild(iframe)
  }

  const doc = iframe.contentWindow.document
  doc.open()
  doc.write(html)
  doc.close()

  // Ensure logo image has loaded before triggering print dialog
  const triggerPrint = () => {
    try {
      iframe.contentWindow.focus()
      iframe.contentWindow.print()
    } catch (e) {
      console.error('Print trigger failed:', e)
    }
  }

  const img = doc.querySelector('img')
  if (img && !img.complete) {
    let printed = false
    const safePrint = () => {
      if (!printed) {
        printed = true
        setTimeout(triggerPrint, 100)
      }
    }
    img.onload = safePrint
    img.onerror = safePrint
    setTimeout(safePrint, 1200) // fallback safety timeout
  } else {
    setTimeout(triggerPrint, 350)
  }
}

/**
 * Export CSV with single header row, ISO dates, UTF-8 BOM, and Audit Log
 */
export async function exportReportToCSV(options) {
  const {
    activeTab,
    dateFrom,
    dateTo,
    type,
    status,
    serviceId,
    staffId,
    data = {},
    invSubView = 'stock',
  } = options

  // 1. Audit log
  try {
    await reportsApi.logExport({
      report: activeTab,
      format: 'csv',
      filters: { date_from: dateFrom, date_to: dateTo, type, status, service_id: serviceId, staff_id: staffId },
    })
  } catch (err) {
    console.error('Failed to log CSV export:', err)
  }

  let headers = []
  let rows = []
  let filename = ''

  if (activeTab === 'appointments') {
    const list = data.appointments || []
    if (list.length === 0) {
      toast.error('No appointment records to export.')
      return
    }
    headers = ['Date', 'Patient Name', 'Student ID', 'Service', 'Attending Staff', 'Type', 'Status', 'Diagnosis', 'Treatment']
    rows = list.map(app => {
      const u = app.patient?.user
      const c = app.clinic_record || app.dental_consultation
      return [
        toISODateTime(app.scheduled_at),
        u?.name || 'N/A',
        u?.student_id || u?.employee_id || EMPTY,
        app.service?.name || EMPTY,
        app.staff?.name || EMPTY,
        app.appointment_type || 'general',
        app.status || 'pending',
        c?.diagnosis || EMPTY,
        c?.treatment || c?.treatment_performed || EMPTY,
      ]
    })
    filename = `Appointments_Report_${dateFrom}_to_${dateTo}.csv`
  } else if (activeTab === 'consultations') {
    const list = data.consultations || []
    if (list.length === 0) {
      toast.error('No consultation records to export.')
      return
    }
    headers = ['Date', 'Patient Name', 'Student ID', 'Role', 'Type', 'Service', 'Attending Staff', 'Complaint Category', 'Chief Complaint', 'Diagnosis', 'Treatment']
    rows = list.map(c => [
      c.raw_date || toISODate(c.date),
      c.patient_name || EMPTY,
      c.student_id || EMPTY,
      c.role || 'student',
      c.type || 'medical',
      c.service || NO_SERVICE,
      c.attending_staff || EMPTY,
      c.complaint_category || EMPTY,
      c.complaint_diagnosis || EMPTY,
      c.diagnosis || EMPTY,
      c.treatment || EMPTY,
    ])
    filename = `Consultations_Report_${dateFrom}_to_${dateTo}.csv`
  } else if (activeTab === 'inventory') {
    if (invSubView === 'usage') {
      const list = data.invTransactions || []
      if (list.length === 0) { toast.error('No usage records to export.'); return }
      headers = ['Date', 'Item Name', 'Category', 'Batch No', 'Type', 'Quantity', 'Reason', 'Recorded By']
      rows = list.map(t => [
        t.raw_date || toISODate(t.transaction_date),
        t.item_name || EMPTY,
        t.category || EMPTY,
        t.batch_no || EMPTY,
        t.type || 'OUT',
        t.quantity ?? 0,
        t.reason || EMPTY,
        t.recorded_by || EMPTY,
      ])
      filename = `Inventory_Usage_Report_${dateFrom}_to_${dateTo}.csv`
    } else if (invSubView === 'expiring') {
      const list = data.expiringBatches || []
      if (list.length === 0) { toast.error('No expiring batch records to export.'); return }
      headers = ['Item Name', 'Category', 'Batch No', 'Supplier', 'Expiry Date', 'Remaining Quantity', 'Status']
      rows = list.map(b => [
        b.item_name || EMPTY,
        b.category || EMPTY,
        b.batch_no || EMPTY,
        b.supplier || EMPTY,
        b.expiry_date || EMPTY,
        b.remaining ?? 0,
        b.status || EMPTY,
      ])
      filename = `Inventory_Expiring_Batches_Report_${dateFrom}_to_${dateTo}.csv`
    } else {
      const list = (invSubView === 'low_stock' ? data.lowStockItems : data.invItems) || []
      if (list.length === 0) { toast.error('No inventory records to export.'); return }
      headers = ['Item Name', 'Category', 'Current Stock', 'Unit', 'Reorder Level', 'Location', 'Status']
      rows = list.map(i => [
        i.name || EMPTY,
        i.category || EMPTY,
        i.current_stock ?? 0,
        i.unit || 'pcs',
        i.reorder_level ?? 0,
        i.location || EMPTY,
        i.status || 'normal',
      ])
      filename = `Inventory_Stock_Report_${dateFrom}_to_${dateTo}.csv`
    }
  } else if (activeTab === 'symptoms') {
    const list = data.allSymptomCategories || []
    if (list.length === 0) {
      toast.error('No symptom categories to export.')
      return
    }
    headers = ['Rank', 'Complaint Category', 'Cases Count', 'Percentage']
    rows = list.map((c, i) => [
      i + 1,
      c.name,
      c.count,
      `${c.percentage}%`,
    ])
    filename = `Frequent_Symptoms_Report_${dateFrom}_to_${dateTo}.csv`
  }

  // Construct CSV: one header row, UTF-8 with BOM
  const csvContent = [
    headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','),
    ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')),
  ].join('\r\n')

  // UTF-8 BOM
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  toast.success('Report exported to CSV!')
}
