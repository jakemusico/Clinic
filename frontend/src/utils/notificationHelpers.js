import { formatDate } from './dateUtils'

export function formatNotificationTime(ts) {
  if (!ts) return '-'
  const d = new Date(ts)
  if (isNaN(d.getTime())) return '-'
  const diff = Date.now() - d.getTime()
  if (diff < 0) return 'Just now'
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return formatDate(d)
}

export function isAnnouncementItem(n) {
  if (!n) return false
  if (n.category === 'announcements') return true
  if (n.category === 'appointments' || n.category === 'personal') return false
  if (n.type === 'announcement' || n.is_broadcast) return true
  if (n.action_url === '/calendar') return true
  const text = `${n.title || ''} ${n.message || ''}`.toLowerCase()
  if (/closure|holiday|health activity|health fair|vaccination drive|blood drive|advisory|maintenance|guidelines/i.test(n.title || '')) return true
  return /announcement|notice|schedule/i.test(n.title || '') && !/appointment|consultation|booking/i.test(n.title || '')
}

export function isAppointmentItem(n) {
  if (!n) return false
  if (n.category === 'appointments') return true
  if (n.category === 'announcements') return false
  if (n.action_url && n.action_url.includes('/appointments')) return true
  const text = `${n.title || ''} ${n.message || ''}`.toLowerCase()
  return /appointment|consultation|booked|reschedule|cancelled|confirmed|completed|checkup|dentist slot|clinic visit/i.test(text)
}

export function getAppointmentTargetUrl(notif, userRole) {
  const text = `${notif.title || ''} ${notif.message || ''}`.toLowerCase()

  // 1. Determine status
  let status = 'all'
  if (text.includes('cancel')) status = 'cancelled'
  else if (text.includes('confirm')) status = 'confirmed'
  else if (text.includes('complete')) status = 'completed'
  else if (text.includes('reschedul') || text.includes('booked') || text.includes('pending')) status = 'pending'

  // 2. Extract highlight ID
  let highlight = ''
  if (notif.action_url) {
    const hlMatch = notif.action_url.match(/highlight=(\d+)/)
    if (hlMatch) {
      highlight = hlMatch[1]
    } else {
      const apptMatch = notif.action_url.match(/appointments\/(\d+)/)
      if (apptMatch) highlight = apptMatch[1]
    }
  }

  // 3. Determine base route by role & service type
  const isDental = /dental|tooth|teeth|oral|dentist/i.test(text) || (notif.action_url && notif.action_url.includes('dental'))

  let basePath = '/appointments'
  if (userRole === 'dentist') {
    basePath = '/dental/appointments'
  } else if (userRole === 'clinic_staff') {
    basePath = '/clinic/appointments'
  } else if (userRole === 'admin') {
    basePath = isDental ? '/dental/appointments' : '/clinic/appointments'
  } else {
    basePath = '/appointments'
  }

  const params = new URLSearchParams()
  if (status !== 'all') params.set('status', status)
  if (highlight) params.set('highlight', highlight)

  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}
