/**
 * Clinic Portal Mock Data Store
 * Keeps Admin and Student portals synced via localStorage.
 */

export const DEFAULT_SCHEDULE = [
  { day: 'Monday',    is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'Tuesday',   is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'Wednesday', is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'Thursday',  is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'Friday',    is_open: true,  open_time: '08:00', close_time: '17:00' },
  { day: 'Saturday',  is_open: true,  open_time: '08:00', close_time: '12:00' },
  { day: 'Sunday',    is_open: false, open_time: '08:00', close_time: '17:00' },
]

export const DEFAULT_CLINIC_INFO = {
  schedule: DEFAULT_SCHEDULE,
  schedule_note: 'Emergency on-call on weekends',
  location_name: 'Fr. Saturnino Urios University',
  location_address: 'Ground Floor, Administration & Student Welfare Wing, San Francisco St., Butuan City, 8600',
  location_landmark: 'Beside Guidance Center & Student Affairs Office',
  contact_trunkline: '(085) 342-1830 loc. 124',
  contact_mobile: '0917-123-4567',
  contact_email: 'clinic@urios.edu.ph',
}

export const DEFAULT_FAQS = [
  {
    id: 1,
    question: 'How do I book an appointment with the doctor or dentist?',
    answer: 'Navigate to the Appointments page from your sidebar. Choose either Medical Care or Dental Care, select an available service and date on the calendar, pick an open time slot, and submit your booking.',
    category: 'appointments',
    show_on_help: true,
    is_active: true,
    sort_order: 1,
  },
  {
    id: 2,
    question: 'What should I bring for my annual physical examination?',
    answer: 'Please bring your valid FSUU Student ID, your vaccination record, and any completed Health Examination forms. Fasting is not required unless specified for special blood chemistry laboratory work.',
    category: 'requirements',
    show_on_help: true,
    is_active: true,
    sort_order: 2,
  },
  {
    id: 3,
    question: 'How do I obtain a medical certificate or excuse slip for missed classes?',
    answer: 'Book \'Issuance of Medical Certificate\' under Medical in Appointments, then visit the clinic for processing.',
    category: 'services',
    show_on_help: true,
    is_active: true,
    sort_order: 3,
  },
  {
    id: 4,
    question: 'Are clinic consultations, first-aid, and basic medicines free for students?',
    answer: 'Yes. Primary healthcare consultations, emergency first-aid triage, over-the-counter emergency medications, and routine dental assessments are provided free of charge as part of your institutional health privileges.',
    category: 'services',
    show_on_help: true,
    is_active: true,
    sort_order: 4,
  },
  {
    id: 5,
    question: 'What should I do during an on-campus medical emergency?',
    answer: 'Immediately contact the Clinic Hotline at (085) 342-1830 local 124 or 0917-123-4567, or alert the nearest campus security officer. Clinic first responders will be dispatched promptly.',
    category: 'emergency',
    show_on_help: true,
    is_active: true,
    sort_order: 5,
  },
]

export const DEFAULT_ANNOUNCEMENTS = [
  {
    id: 'ann-1',
    title: 'Annual Physical Examination for College Students',
    message: 'All 1st year and graduating students must undergo mandatory physical examinations this semester at the Main Clinic. Clinic hours: 8:00 AM – 5:00 PM.',
    audience: 'Students',
    created_at: '2026-10-14T08:00:00.000Z',
  },
  {
    id: 'ann-2',
    title: 'Free Dental Cleaning & Fluoridation Month',
    message: 'Free oral prophylaxis and dental assessment for all enrolled students at the Dental Clinic. Book a slot or consult on-site.',
    audience: 'Students',
    created_at: '2026-10-10T09:00:00.000Z',
  },
  {
    id: 'ann-3',
    title: 'Campus Seasonal Flu Vaccination Drive',
    message: 'Free seasonal influenza vaccines will be administered at the University Gymnasium. Present your valid FSUU student ID.',
    audience: 'All',
    created_at: '2026-10-05T08:30:00.000Z',
  },
]

// ── Helpers ──────────────────────────────────────────────────────────────

export function formatTime12h(timeStr) {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  let h = parseInt(hStr, 10)
  if (isNaN(h)) return timeStr
  const m = mStr || '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${m} ${ampm}`
}

export function groupScheduleDays(schedule) {
  if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
    return []
  }

  const groups = []
  let current = {
    startDay: schedule[0].day,
    endDay: schedule[0].day,
    is_open: Boolean(schedule[0].is_open),
    hoursStr: schedule[0].is_open
      ? `${formatTime12h(schedule[0].open_time)} – ${formatTime12h(schedule[0].close_time)}`
      : 'Closed',
  }

  for (let i = 1; i < schedule.length; i++) {
    const item = schedule[i]
    const itemIsOpen = Boolean(item.is_open)
    const itemHoursStr = itemIsOpen
      ? `${formatTime12h(item.open_time)} – ${formatTime12h(item.close_time)}`
      : 'Closed'

    if (itemHoursStr === current.hoursStr && itemIsOpen === current.is_open) {
      current.endDay = item.day
    } else {
      groups.push(current)
      current = {
        startDay: item.day,
        endDay: item.day,
        is_open: itemIsOpen,
        hoursStr: itemHoursStr,
      }
    }
  }
  groups.push(current)

  return groups.map(g => ({
    label: g.startDay === g.endDay ? g.startDay : `${g.startDay} – ${g.endDay}`,
    hours: g.hoursStr,
    is_open: g.is_open,
  }))
}

export function getClinicInfo() {
  try {
    const val = localStorage.getItem('fsuu_clinic_info')
    if (!val) return DEFAULT_CLINIC_INFO
    const parsed = JSON.parse(val)
    return {
      ...DEFAULT_CLINIC_INFO,
      ...parsed,
      schedule: Array.isArray(parsed.schedule) && parsed.schedule.length === 7
        ? parsed.schedule
        : DEFAULT_SCHEDULE,
      schedule_note: parsed.schedule_note !== undefined ? parsed.schedule_note : DEFAULT_CLINIC_INFO.schedule_note,
    }
  } catch {
    return DEFAULT_CLINIC_INFO
  }
}

export function saveClinicInfo(info) {
  try {
    localStorage.setItem('fsuu_clinic_info', JSON.stringify(info))
    window.dispatchEvent(new Event('clinic-info-updated'))
  } catch {}
}

export function getFaqs() {
  try {
    const val = localStorage.getItem('fsuu_chatbot_faqs')
    return val ? JSON.parse(val) : DEFAULT_FAQS
  } catch {
    return DEFAULT_FAQS
  }
}

export function saveFaqs(faqs) {
  try {
    localStorage.setItem('fsuu_chatbot_faqs', JSON.stringify(faqs))
    window.dispatchEvent(new Event('faqs-updated'))
  } catch {}
}

export function getAnnouncements() {
  try {
    const val = localStorage.getItem('fsuu_announcements')
    return val ? JSON.parse(val) : DEFAULT_ANNOUNCEMENTS
  } catch {
    return DEFAULT_ANNOUNCEMENTS
  }
}

export function saveAnnouncements(list) {
  try {
    localStorage.setItem('fsuu_announcements', JSON.stringify(list))
    window.dispatchEvent(new Event('announcements-updated'))
  } catch {}
}

export function addPersonalNotification(notif) {
  try {
    const raw = localStorage.getItem('fsuu_custom_notifications')
    const existing = raw ? JSON.parse(raw) : []
    const updated = [notif, ...existing]
    localStorage.setItem('fsuu_custom_notifications', JSON.stringify(updated))
    window.dispatchEvent(new Event('notifications-updated'))
  } catch {}
}

export function getCustomNotifications() {
  try {
    const raw = localStorage.getItem('fsuu_custom_notifications')
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}
