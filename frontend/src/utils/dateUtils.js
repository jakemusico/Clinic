const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Extracts a date string or Date object from an input (appointment object or raw value)
 */
export function getAppointmentDateRaw(val) {
  if (!val) return null
  if (typeof val === 'object' && !(val instanceof Date)) {
    return val.scheduled_at || val.appointment_date || val.date || null
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

  if (typeof raw === 'string') {
    // Check for "YYYY-MM-DD" pattern
    const m = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (m) {
      const year = parseInt(m[1], 10)
      const month = parseInt(m[2], 10)
      const day = parseInt(m[3], 10)
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        return `${MONTHS[month - 1]} ${day}, ${year}`
      }
    }
  }

  const d = new Date(raw)
  if (isNaN(d.getTime())) return '-'
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
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

  let hours = d.getHours()
  const minutes = String(d.getMinutes()).padStart(2, '0')
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
 * Returns "—" for null, empty, or invalid values. Never returns "Invalid Date".
 */
export function formatDate(val) {
  if (!val) return '—'

  let raw = val
  if (typeof val === 'object' && !(val instanceof Date)) {
    raw = val.expiry_date || val.received_date || val.scheduled_at || val.appointment_date || val.transaction_date || val.date || val.created_at || null
  }
  if (!raw) return '—'

  if (raw instanceof Date) {
    if (isNaN(raw.getTime())) return '—'
    return `${MONTHS[raw.getMonth()]} ${raw.getDate()}, ${raw.getFullYear()}`
  }

  const str = String(raw).trim()
  if (!str || str === 'null' || str === 'undefined' || str === '0000-00-00') return '—'

  // Match pure YYYY-MM-DD
  const ymdOnly = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymdOnly) {
    const year = parseInt(ymdOnly[1], 10)
    const month = parseInt(ymdOnly[2], 10)
    const day = parseInt(ymdOnly[3], 10)
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      return `${MONTHS[month - 1]} ${day}, ${year}`
    }
  }

  // Handle ISO string or date with time
  const d = new Date(str)
  if (isNaN(d.getTime())) return '—'

  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
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
