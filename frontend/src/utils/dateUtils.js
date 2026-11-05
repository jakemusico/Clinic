import { EMPTY } from './emptyValue'
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** The clinic works in this time zone. Laravel (APP_TIMEZONE) uses the same one. */
export const APP_TIME_ZONE = 'Asia/Manila'

const pad2 = (n) => String(n).padStart(2, '0')

/** Wall-clock parts of an instant in the clinic's time zone. */
function clinicParts(date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIME_ZONE,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(date)
  const get = (t) => parts.find((p) => p.type === t)?.value
  return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), mi: get('minute'), s: get('second') }
}

/** Today as YYYY-MM-DD in the clinic's time zone (never the UTC date that toISOString gives). */
export function todayISO() {
  const { y, m, d } = clinicParts(new Date())
  return `${y}-${m}-${d}`
}

/**
 * The calendar day of a value as YYYY-MM-DD, or null when it is not a date.
 *  - 'YYYY-MM-DD' (what the API sends for date columns) is returned as it is
 *  - a timestamp with no zone ('2026-11-03 10:14:10') keeps its own day
 *  - a timestamp with a zone ('...T16:00:00.000000Z') is converted to the clinic's time zone
 * Use this instead of split('T')[0] or toISOString(), which give the UTC day and so are a day off.
 */
export function toDateKey(val) {
  if (val === null || val === undefined || val === '') return null
  if (val instanceof Date) {
    return Number.isNaN(val.getTime()) ? null : `${val.getFullYear()}-${pad2(val.getMonth() + 1)}-${pad2(val.getDate())}`
  }
  const str = String(val).trim()
  if (!str || str === 'null' || str === 'undefined' || str === '0000-00-00') return null
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str
  const noZone = str.match(/^(\d{4}-\d{2}-\d{2})[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/)
  if (noZone) return noZone[1]
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return null
  const { y, m, d: day } = clinicParts(d)
  return `${y}-${m}-${day}`
}

/** 'YYYY-MM-DD HH:mm:ss' in the clinic's time zone (CSV / report exports). */
export function toDateTimeKey(val) {
  if (!val) return null
  const str = String(val).trim()
  const noZone = str.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(?::(\d{2}))?/)
  if (noZone && !/(Z|[+-]\d{2}:?\d{2})$/.test(str)) return `${noZone[1]} ${noZone[2]}:${noZone[3] || '00'}`
  const d = new Date(str)
  if (Number.isNaN(d.getTime())) return null
  const { y, m, d: day, h, mi, s } = clinicParts(d)
  return `${y}-${m}-${day} ${h}:${mi}:${s}`
}

/**
 * Long date for detail views, tables and print: 'Tue, Nov 3, 2026'.
 * Built from the calendar day only, so it never moves by a day with the browser's time zone.
 * @param {object} [opts] Intl.DateTimeFormat options (weekday / month / year / day)
 */
export function formatDateLong(val, opts = {}) {
  const key = toDateKey(typeof val === 'object' && val !== null && !(val instanceof Date) ? (val.raw_date || val.visit_date || val.consultation_date || val.date) : val)
  if (!key) return EMPTY
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12))
  if (Number.isNaN(dt.getTime())) return EMPTY
  return dt.toLocaleDateString('en-PH', {
    timeZone: 'UTC',
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
    ...opts,
  })
}

/**
 * Extracts a date string or Date object from an input (appointment object or raw value)
 */
export function getAppointmentDateRaw(val) {
  if (!val) return null
  if (typeof val === 'object' && !(val instanceof Date)) {
    return val.appointment_date || val.scheduled_at || val.date || null
  }
  return val
}

/**
 * Extracts a time string from an input (appointment object or raw value)
 */
export function getAppointmentTimeRaw(val) {
  if (!val) return null
  if (typeof val === 'object' && !(val instanceof Date)) {
    return val.appointment_time || val.scheduled_at || val.time || null
  }
  return val
}

/**
 * Formats appointment date as "Oct 21, 2026"
 * Handles null, empty, invalid date with "-"
 */
export function formatAppointmentDate(val) {
  const raw = getAppointmentDateRaw(val)
  if (!raw) return '-'

  const key = toDateKey(raw)
  if (!key) return '-'
  const [year, month, day] = key.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

/**
 * Formats appointment time as "9:30 AM"
 * Handles null, empty, invalid time with "-"
 */
export function formatAppointmentTime(val) {
  const raw = getAppointmentTimeRaw(val)
  if (!raw) return '-'

  if (typeof raw === 'string') {
    // Already in "h:mm AM/PM" or "hh:mm AM/PM"
    const ampmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)$/i)
    if (ampmMatch) {
      const hour = parseInt(ampmMatch[1], 10)
      const min = ampmMatch[2]
      const ampm = ampmMatch[3].toUpperCase()
      return `${hour}:${min} ${ampm}`
    }

    // In "HH:mm" or "HH:mm:ss" without date component
    const timeOnlyMatch = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/)
    if (timeOnlyMatch) {
      let hour = parseInt(timeOnlyMatch[1], 10)
      const min = timeOnlyMatch[2]
      const ampm = hour >= 12 ? 'PM' : 'AM'
      hour = hour % 12 || 12
      return `${hour}:${min} ${ampm}`
    }
  }

  const d = new Date(raw)
  if (isNaN(d.getTime())) return '-'

  // clock time in the clinic's time zone, the same one the server uses
  const parts = clinicParts(d)
  let hours = parseInt(parts.h, 10)
  const minutes = parts.mi
  const ampm = hours >= 12 ? 'PM' : 'AM'
  hours = hours % 12 || 12
  return `${hours}:${minutes} ${ampm}`
}

/**
 * Formats date and time as "Oct 21, 2026 · 9:30 AM"
 */
export function formatAppointmentDateTime(val) {
  const d = formatAppointmentDate(val)
  const t = formatAppointmentTime(val)
  if (d === '-' && t === '-') return '-'
  if (d === '-') return t
  if (t === '-') return d
  return `${d} · ${t}`
}

/**
 * Formats a date value (string, Date, or object) as "Oct 19, 2028".
 * Returns EMPTY for null, empty, or invalid values. Never returns "Invalid Date".
 */
export function formatDate(val) {
  if (!val) return EMPTY

  let raw = val
  if (typeof val === 'object' && !(val instanceof Date)) {
    raw = val.expiry_date || val.received_date || val.appointment_date || val.scheduled_at || val.transaction_date || val.raw_date || val.visit_date || val.consultation_date || val.date || val.created_at || null
  }
  if (!raw) return EMPTY

  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return EMPTY
    return `${MONTHS[raw.getMonth()]} ${raw.getDate()}, ${raw.getFullYear()}`
  }

  const key = toDateKey(raw)
  if (!key) return EMPTY
  const [year, month, day] = key.split('-').map(Number)
  return `${MONTHS[month - 1]} ${day}, ${year}`
}

/**
 * Checks if a date is strictly in the past (before today at midnight).
 */
export function isDateExpired(val) {
  if (!val) return false
  const str = String(val).trim()
  if (!str || str === 'null' || str === 'undefined' || str === '0000-00-00') return false

  let targetDate
  const ymdOnly = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymdOnly) {
    targetDate = new Date(parseInt(ymdOnly[1], 10), parseInt(ymdOnly[2], 10) - 1, parseInt(ymdOnly[3], 10))
  } else {
    targetDate = new Date(str)
  }

  if (isNaN(targetDate.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  targetDate.setHours(0, 0, 0, 0)

  return targetDate.getTime() < today.getTime()
}

/**
 * Checks if a date is within the next 30 days (from today up to today + 30 days), and not expired.
 */
export function isDateExpiringSoon(val) {
  if (!val) return false
  const str = String(val).trim()
  if (!str || str === 'null' || str === 'undefined' || str === '0000-00-00') return false

  let targetDate
  const ymdOnly = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymdOnly) {
    targetDate = new Date(parseInt(ymdOnly[1], 10), parseInt(ymdOnly[2], 10) - 1, parseInt(ymdOnly[3], 10))
  } else {
    targetDate = new Date(str)
  }

  if (isNaN(targetDate.getTime())) return false

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  targetDate.setHours(0, 0, 0, 0)

  if (targetDate.getTime() < today.getTime()) return false

  const in30Days = new Date(today)
  in30Days.setDate(in30Days.getDate() + 30)

  return targetDate.getTime() <= in30Days.getTime()
}

export function formatTime(val) {
  return formatAppointmentTime(val)
}
