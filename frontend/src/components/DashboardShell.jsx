import { Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation, Link, NavLink, Outlet } from 'react-router-dom'
import { toast } from 'react-hot-toast'
import { useAuth } from '../context/AuthContext'
import { useChatbot } from '../context/ChatbotContext'
import { notificationsApi } from '../api/notifications'
import { adminApi } from '../api/admin'
import { chatApi } from '../api/chat'
import { useCounters } from '../hooks/useCounters'
import { PageFallback } from './dashboard/Fallbacks'
import { poll } from '../utils/polling'
import ChatbotWidget from './ChatbotWidget'
import fsuuLogo from '../assets/fsuu_logo.png'
import PatientSearchBar from './PatientSearchBar'
import DentalIcon from './DentalIcon'
import Avatar from './Avatar'
import EventDetailsModal from './EventDetailsModal'
import { formatNotificationTime, isAnnouncementItem, isAppointmentItem, getAppointmentTargetUrl } from '../utils/notificationHelpers'

const ROLE_LABELS = {
  student: 'Student',
  faculty_staff: 'Faculty / Staff',
  clinic_staff: 'Nurse',
  dentist: 'Dentist',
  admin: 'Administrator',
}

const ROLE_COLORS = {
  student: 'role-blue',
  faculty_staff: 'role-teal',
  clinic_staff: 'role-purple',
  dentist: 'role-teal',
  admin: 'role-gold',
}

/* ── Lucide-style inline SVG icons ─────────────────────────────── */
const Icon = ({ d, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
)

// Inventory list pages with a frozen filter bar + table header (only the rows scroll)
const FROZEN_INVENTORY_PAGES = [
  '/clinic/inventory/items',
  '/clinic/inventory/stock-in',
  '/clinic/inventory/stock-out',
  '/clinic/inventory/transactions',
]


// Icon keys that render the shared tooth icon instead of a path from ICONS
const DENTAL_ICON_KEYS = new Set(['tooth', 'dentalChart'])

const ICONS = {
  dashboard: 'M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM9 22V12h6v10',
  appointments: 'M8 2v4M16 2v4M3 10h18M3 6a2 2 0 012-2h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6z',
  records: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
  services: 'M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18',
  schedule: 'M12 2a10 10 0 100 20A10 10 0 0012 2zM12 6v6l4 2',
  reports: 'M18 20V10M12 20V4M6 20v-6',
  chatbot: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  messages: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
  notifications: 'M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0',
  users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
  sections: 'M4 6h16M4 10h16M4 14h16M4 18h16',
  audit: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  myRecords: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  consultations: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
  profile: 'M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8',
  settings: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z',
  logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
  chevronDown: 'M6 9l6 6 6-6',
  terms: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  certificates: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  forms: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l2 2 4-4',
  help: 'M12 22a10 10 0 100-20 10 10 0 000 20zm0-6h.01M12 13a2 2 0 10-2-2',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  announcements: 'M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 8a3 3 0 010 6M11 5.882a4.42 4.42 0 017 3.52 4.42 4.42 0 01-7 3.52',
  inventory: 'M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12',
  items: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h6m-6 4h6',
  stockIn: 'M12 3v13m0 0l-4-4m4 4l4-4M4 20h16',
  stockOut: 'M12 17V4m0 0l-4 4m4-4l4 4M4 20h16',
  transactions: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
}

/* Sidebar / bottom-nav / stat-card icon: shared tooth for dental keys, path icon for the rest */
const NavIcon = ({ name, size, fallback }) =>
  DENTAL_ICON_KEYS.has(name)
    ? <DentalIcon size={size} />
    : <Icon d={ICONS[name] || (fallback ? ICONS[fallback] : undefined)} size={size} />

/* Nav sections per role */
const NAV_SECTIONS = {
  student: [
    {
      label: 'Main',
      items: [
        { to: '/dashboard/student', label: 'Dashboard', icon: 'dashboard' },
        { to: '/appointments', label: 'Appointments', icon: 'appointments' },
        { to: '/my-records', label: 'My Health Records', icon: 'myRecords' },
        { to: '/notifications', label: 'Notifications', icon: 'notifications' },
      ],
    },
    {
      label: 'Account',
      items: [
        { to: '/profile', label: 'My Profile', icon: 'profile' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
        { to: '/help-contact', label: 'Help & Contact Clinic', icon: 'help' },
      ],
    },
  ],
  faculty_staff: [
    {
      label: 'Main',
      items: [
        { to: '/dashboard/faculty', label: 'Dashboard', icon: 'dashboard' },
        { to: '/appointments', label: 'Appointments', icon: 'appointments' },
        { to: '/my-records', label: 'My Health Records', icon: 'myRecords' },
        { to: '/notifications', label: 'Notifications', icon: 'notifications' },
      ],
    },
    {
      label: 'Account',
      items: [
        { to: '/profile', label: 'My Profile', icon: 'profile' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ],
  clinic_staff: [
    {
      label: 'Overview',
      items: [
        { to: '/dashboard/clinic-staff', label: 'Dashboard', icon: 'dashboard' },
        { to: '/notifications', label: 'Notifications', icon: 'notifications' },
      ],
    },
    {
      label: 'Medical Care',
      items: [
        { to: '/clinic/records', label: 'Medical Records', icon: 'records' },
        { to: '/clinic/appointments', label: 'Medical Appointments', icon: 'appointments' },
        { to: '/clinic/consultations', label: 'Medical Consultations', icon: 'consultations' },
      ],
    },
    {
      label: 'Directory',
      items: [
        { to: '/clinic/people', label: 'People', icon: 'users' },
        { to: '/clinic/messages', label: 'Messages', icon: 'messages' },
      ],
    },
    {
      label: 'Management',
      items: [
        { to: '/clinic/schedule', label: 'My Schedule', icon: 'calendar' },
        { to: '/clinic/reports', label: 'Reports', icon: 'reports' },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { to: '/clinic/inventory', label: 'Inventory Dashboard', icon: 'inventory', end: true },
        { to: '/clinic/inventory/items', label: 'Items', icon: 'items', end: true },
        { to: '/clinic/inventory/stock-in', label: 'Stock In', icon: 'stockIn', end: true },
        { to: '/clinic/inventory/stock-out', label: 'Stock Out', icon: 'stockOut', end: true },
        { to: '/clinic/inventory/transactions', label: 'Transactions', icon: 'transactions', end: true },
      ],
    },
    {
      label: 'System',
      items: [
        { to: '/profile', label: 'My Profile', icon: 'profile' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ],
  dentist: [
    {
      label: 'Overview',
      items: [
        { to: '/dashboard/dentist', label: 'Dashboard', icon: 'dashboard' },
        { to: '/notifications', label: 'Notifications', icon: 'notifications' },
      ],
    },
    {
      label: 'Dental Care',
      items: [
        { to: '/dental/records', label: 'Dental Records', icon: 'tooth' },
        { to: '/dental/appointments', label: 'Dental Appointments', icon: 'tooth' },
        { to: '/dental/consultations', label: 'Dental Consultations', icon: 'tooth' },
        { to: '/dental/chart', label: 'Dental Charting', icon: 'tooth' },
      ],
    },
    {
      label: 'Directory',
      items: [
        { to: '/clinic/people', label: 'People', icon: 'users' },
        { to: '/clinic/messages', label: 'Messages', icon: 'messages' },
      ],
    },
    {
      label: 'Management',
      items: [
        { to: '/clinic/schedule', label: 'My Schedule', icon: 'calendar' },
        { to: '/clinic/reports', label: 'Reports', icon: 'reports' },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { to: '/clinic/inventory', label: 'Inventory Dashboard', icon: 'inventory', end: true },
        { to: '/clinic/inventory/items', label: 'Items', icon: 'items', end: true },
        { to: '/clinic/inventory/stock-in', label: 'Stock In', icon: 'stockIn', end: true },
        { to: '/clinic/inventory/stock-out', label: 'Stock Out', icon: 'stockOut', end: true },
        { to: '/clinic/inventory/transactions', label: 'Transactions', icon: 'transactions', end: true },
      ],
    },
    {
      label: 'System',
      items: [
        { to: '/profile', label: 'My Profile', icon: 'profile' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ],
  admin: [
    {
      label: 'Overview',
      items: [
        { to: '/dashboard/admin', label: 'Dashboard', icon: 'dashboard', end: true },
        { to: '/notifications', label: 'Notifications', icon: 'notifications' },
      ],
    },
    {
      label: 'Medical Care',
      items: [
        { to: '/clinic/records', label: 'Medical Records', icon: 'records' },
        { to: '/clinic/appointments', label: 'Medical Appointments', icon: 'appointments' },
        { to: '/clinic/consultations', label: 'Medical Consultations', icon: 'consultations' },
      ],
    },
    {
      label: 'Dental Care',
      items: [
        { to: '/dental/records', label: 'Dental Records', icon: 'tooth' },
        { to: '/dental/appointments', label: 'Dental Appointments', icon: 'tooth' },
        { to: '/dental/consultations', label: 'Dental Consultations', icon: 'tooth' },
        { to: '/dental/chart', label: 'Dental Charting', icon: 'tooth' },
      ],
    },
    {
      label: 'Directory',
      items: [
        { to: '/clinic/people', label: 'People', icon: 'users' },
      ],
    },
    {
      label: 'Management',
      items: [
        { to: '/clinic/services', label: 'Clinic Services', icon: 'services' },
        { to: '/clinic/schedule', label: 'Staff Schedules', icon: 'calendar' },
        { to: '/admin/calendar', label: 'Calendar', icon: 'appointments' },
        { to: '/admin/announcements', label: 'Announcements', icon: 'announcements' },
        { to: '/admin/users', label: 'User Management', icon: 'users' },
        { to: '/admin/sections', label: 'Sections', icon: 'sections' },
        { to: '/clinic/reports', label: 'Reports', icon: 'reports' },
      ],
    },
    {
      label: 'Inventory',
      items: [
        { to: '/clinic/inventory', label: 'Inventory Dashboard', icon: 'inventory', end: true },
        { to: '/clinic/inventory/items', label: 'Items', icon: 'items', end: true },
        { to: '/clinic/inventory/stock-in', label: 'Stock In', icon: 'stockIn', end: true },
        { to: '/clinic/inventory/stock-out', label: 'Stock Out', icon: 'stockOut', end: true },
        { to: '/clinic/inventory/transactions', label: 'Transactions', icon: 'transactions', end: true },
      ],
    },
    {
      label: 'System',
      items: [
        { to: '/admin/clinic-info', label: 'Clinic Info', icon: 'info' },
        { to: '/chatbot/support', label: 'Chatbot Support', icon: 'chatbot' },
        { to: '/admin/audit-logs', label: 'Audit Logs', icon: 'audit' },
        { to: '/admin/terms', label: 'Terms & Privacy', icon: 'terms' },
        { to: '/admin/complaint-categories', label: 'Complaint Categories', icon: 'services' },
        { to: '/profile', label: 'My Profile', icon: 'profile' },
        { to: '/settings', label: 'Settings', icon: 'settings' },
      ],
    },
  ],
}

function formatRelativeTime(ts) {
  return formatNotificationTime(ts)
}

export default function DashboardShell() {
  const [pageInfo, setPageInfo] = useState({ title: '', subtitle: '', stats: [] })
  const { title, subtitle, stats } = pageInfo
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [unreadCount, setUnreadCount] = useState(0)
  const [apptCounts, setApptCounts] = useState({
    unread_count: 0,
    medical_unread_count: 0,
    dental_unread_count: 0,
  })
  const { openLiveChat } = useChatbot()
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [notifDropdownOpen, setNotifDropdownOpen] = useState(false)
  const [recentNotifs, setRecentNotifs] = useState([])
  const [viewingAnnouncement, setViewingAnnouncement] = useState(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const notifDropdownRef = useRef(null)
  const dropdownRef = useRef(null)

  // Header badges (bell, appointment requests, unread chat): ONE shared request, polled every
  // 45 s while the tab is visible and refreshed at once by the 'notifications-updated',
  // 'appointments-updated' and 'messages-updated' events. See hooks/useCounters.
  const counters = useCounters(!!user?.id)

  useEffect(() => {
    setUnreadCount(counters.notifications.unread_count)
    setRecentNotifs(counters.notifications.recent)
  }, [counters.notifications])

  useEffect(() => {
    setApptCounts(counters.appointments)
  }, [counters.appointments])

  useEffect(() => {
    setUnreadMessagesCount(counters.chat.unread_count || 0)
  }, [counters.chat.unread_count])

  // Close notification dropdown on route change
  useEffect(() => {
    setNotifDropdownOpen(false)
  }, [location.pathname])

  // Close notification dropdown on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && notifDropdownOpen) {
        setNotifDropdownOpen(false)
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [notifDropdownOpen])

  // Heartbeat for staff (nurse / dentist): keeps last_active_at fresh so students see "Online".
  // Every 60 s. Unlike the badges it also runs in a hidden tab, otherwise a nurse who switches
  // tabs for two minutes would show as offline.
  useEffect(() => {
    if (!user?.id || !['clinic_staff', 'nurse', 'dentist'].includes(user.role)) return undefined
    return poll(() => chatApi.heartbeat(), 60_000, { whenHidden: true })
  }, [user?.id, user?.role])


  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false)
      }
      if (notifDropdownRef.current && !notifDropdownRef.current.contains(e.target)) {
        setNotifDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setDropdownOpen(false)
        setNotifDropdownOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleLogout = async () => {
    setDropdownOpen(false)
    setSidebarOpen(false)
    await logout()
    toast.success('Signed out successfully.')
    navigate('/login', { replace: true })
  }

  // Close sidebar when route changes (mobile)
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  const sidebarNavRef = useRef(null)
  const headerRef = useRef(null)
  const bottomNavRef = useRef(null)

  // On phones the fixed header wraps onto two rows, so it is taller than the 56px the page
  // body reserves for it and the first row of every page ends up underneath it.
  // Publish the header's real height; index.css uses it as the body's top padding on small screens.
  useEffect(() => {
    const el = headerRef.current
    if (!el) return undefined
    const root = document.documentElement
    const publish = () => root.style.setProperty('--dashboard-header-h', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    publish()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--dashboard-header-h') }
  }, [])

  // Publish the real bottom-nav height so CSS can compute padding-bottom dynamically.
  // Falls back to 65px if ResizeObserver is unavailable.
  useEffect(() => {
    const el = bottomNavRef.current
    if (!el) return undefined
    const root = document.documentElement
    const publish = () => root.style.setProperty('--bottom-nav-height', `${Math.ceil(el.getBoundingClientRect().height)}px`)
    publish()
    if (typeof ResizeObserver === 'undefined') return undefined
    const ro = new ResizeObserver(publish)
    ro.observe(el)
    return () => { ro.disconnect(); root.style.removeProperty('--bottom-nav-height') }
  }, [])
  
  // Default pagination height to 0px on mount (pages with Pagination will publish real height)
  useEffect(() => {
    document.documentElement.style.setProperty('--pagination-height', '0px')
    return () => {
      document.documentElement.style.removeProperty('--pagination-height')
    }
  }, [])

  // Keep active item in view on mount/change, but preserve scroll otherwise
  useEffect(() => {
    if (sidebarNavRef.current) {
      const activeEl = sidebarNavRef.current.querySelector('.nav-item.active')
      if (activeEl) {
        // Only scroll if it's out of view
        const rect = activeEl.getBoundingClientRect()
        const containerRect = sidebarNavRef.current.getBoundingClientRect()
        if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
          activeEl.scrollIntoView({ block: 'nearest' })
        }
      }
    }
  }, [location.pathname])

  const handleNotifClick = async (notif) => {
    // 1. Mark as read immediately in database
    if (!notif.is_read) {
      try {
        await notificationsApi.read(notif.id)
        setUnreadCount(prev => Math.max(0, prev - 1))
        setRecentNotifs(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
        window.dispatchEvent(new Event('notifications-updated'))
      } catch { }
    }
    // 2. Always close dropdown on click
    setNotifDropdownOpen(false)

    // 3. Admin-specific clickable routing and record existence verification
    if (user?.role === 'admin') {
      try {
        const { data } = await adminApi.resolveNotificationTarget(notif.id)
        if (!data.exists) {
          toast.error(data.message || 'The requested record no longer exists.')
          return
        }

        if (data.type === 'inventory_item' || data.type === 'inventory_dashboard') {
          navigate(data.action_url || '/clinic/inventory')
          return
        }

        if (data.type === 'user') {
          navigate(data.action_url || '/admin/users')
          return
        }

        if (data.type === 'announcement') {
          setViewingAnnouncement(data.announcement || notif)
          return
        }

        if (data.type === 'calendar_event') {
          setViewingAnnouncement(data.event || notif)
          return
        }

        if (data.action_url) {
          navigate(data.action_url)
          return
        }
      } catch {
        // Fallback if network or resolution issue
        if (notif.action_url) {
          navigate(notif.action_url)
          return
        }
      }
      return
    }

    // Non-admin roles (unchanged behavior)
    if (isAnnouncementItem(notif)) {
      setViewingAnnouncement(notif)
      return
    }

    if (isAppointmentItem(notif)) {
      const targetUrl = getAppointmentTargetUrl(notif, user?.role)
      navigate(targetUrl)
      return
    }

    // Live Chat notifications (Student or Staff)
    if (notif.target_type === 'conversation' || notif.action_url?.includes('chat=')) {
      if (user?.role === 'student' || user?.role === 'faculty_staff') {
        const match = notif.action_url?.match(/chat=(nurse|dentist)/)
        const role = match ? match[1] : 'nurse'
        openLiveChat(role)
        return
      }
    }

    if (notif.action_url) {
      navigate(notif.action_url)
    } else if (notif.link) {
      navigate(notif.link)
    }
  }

  const handleMarkAllRead = async (e) => {
    e.stopPropagation()
    try {
      await notificationsApi.readAll()
      setUnreadCount(0)
      setRecentNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
      window.dispatchEvent(new Event('notifications-updated'))
    } catch { }
  }

  const navSections = NAV_SECTIONS[user?.role] || []

  const studentAcademicMeta = [
    user?.grade_level,
    user?.section || null,
    user?.school_year ? `SY ${user.school_year}` : null,
  ].filter(Boolean).join(' · ')

  const userMeta = user?.role === 'student'
    ? ([user?.student_id, studentAcademicMeta].filter(Boolean).join(' · ') || user?.student_id)
    : (user?.department || user?.student_id
      ? [user?.student_id, user?.department].filter(Boolean).join(' · ')
      : null)

  // Header + sidebar avatar: photo from the shared user (updates instantly after a profile photo change)
  const renderAvatar = (className, sizeStyle = {}) => (
    <Avatar
      src={user?.avatar_url}
      name={user?.name}
      className={className}
      fallbackText={user?.name?.[0]?.toUpperCase() || 'U'}
      alt={user?.name || 'User Avatar'}
      style={sizeStyle}
    />
  )

  return (
    <div className="dashboard-root">
      {/* ── Mobile sidebar overlay ───────────────────────────────── */}
      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────── */}
      <aside className={`sidebar${sidebarOpen ? ' sidebar-open' : ''}`}>
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-brand-row">
            <img src={fsuuLogo} alt="FSUU Clinic Seal" className="sidebar-brand-logo-img" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">FSUU Clinic</span>
              <span className="sidebar-brand-campus">Fr. Saturnino Urios University</span>
            </div>
          </div>
        </div>

        {/* User profile */}
        <div className="sidebar-user">
          {renderAvatar('user-avatar')}
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className={`user-role-badge ${ROLE_COLORS[user?.role]}`}>
              {ROLE_LABELS[user?.role]}
            </span>
            {userMeta && <span className="user-meta">{userMeta}</span>}
          </div>
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav" ref={sidebarNavRef}>
          {navSections.map((section) => (
            <div key={section.label}>
              <div className="sidebar-nav-section">{section.label}</div>
              {section.items.map((item) => {
                const isNotif = item.to === '/notifications'
                const isMessages = item.to === '/clinic/messages'
                const isExact = Boolean(item.end || item.to === '/clinic/inventory')

                let apptBadge = 0
                if (user && ['clinic_staff', 'dentist', 'admin'].includes(user.role)) {
                  if (item.to === '/clinic/appointments') {
                    apptBadge = apptCounts.medical_unread_count || 0
                  } else if (item.to === '/dental/appointments') {
                    apptBadge = apptCounts.dental_unread_count || 0
                  }
                }

                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={isExact}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <span className="nav-icon">
                      <NavIcon name={item.icon} />
                    </span>
                    {item.label}
                    {isNotif && unreadCount > 0 && (
                      <span className="nav-notif-badge">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {isMessages && unreadMessagesCount > 0 && (
                      <span
                        className="nav-notif-badge"
                        title={`${unreadMessagesCount} unread message${unreadMessagesCount > 1 ? 's' : ''}`}
                      >
                        {unreadMessagesCount > 99 ? '99+' : unreadMessagesCount}
                      </span>
                    )}
                    {apptBadge > 0 && (
                      <span
                        className="nav-notif-badge"
                        title={`${apptBadge} new appointment request${apptBadge > 1 ? 's' : ''}`}
                      >
                        {apptBadge > 99 ? '99+' : apptBadge}
                      </span>
                    )}
                  </NavLink>
                )
              })}
            </div>
          ))}
          
          {/* Mobile-specific Log out item (shown for student/faculty in drawer) */}
          {(user?.role === 'student' || user?.role === 'faculty_staff') && (
            <button
              onClick={handleLogout}
              className="nav-item nav-item-logout mobile-only-nav-item"
            >
              <span className="nav-icon">
                <Icon d={ICONS.logout} />
              </span>
              Sign out
            </button>
          )}
        </nav>

        {/* Desktop Logout (hidden on mobile for student/faculty) */}
        <button 
          id="logout-btn" 
          onClick={handleLogout} 
          className={`sidebar-logout ${(user?.role === 'student' || user?.role === 'faculty_staff') ? 'desktop-only-logout' : ''}`}
        >
          <span className="nav-icon">
            <Icon d={ICONS.logout} />
          </span>
          Sign Out
        </button>
      </aside>

      {/* ── Main ────────────────────────────────────────────────── */}
      <main className="dashboard-main">
        <header className="dashboard-header" ref={headerRef}>
          <div className="header-left">
            {/* Hamburger — only visible on mobile/tablet */}
            <button
              className="header-hamburger"
              onClick={() => setSidebarOpen(prev => !prev)}
              aria-label="Open navigation menu"
              aria-expanded={sidebarOpen}
            >
              <span /><span /><span />
            </button>
            <div>
              <h1 className="dashboard-title">{title}</h1>
              {subtitle && <p className="dashboard-subtitle">{subtitle}</p>}
            </div>
          </div>

          <div className="header-controls">
            <PatientSearchBar />

            <div className="header-user-wrapper" ref={notifDropdownRef}>
              <button
                className={`header-notif-btn ${notifDropdownOpen ? 'active' : ''}`}
                title="Notifications"
                aria-label="Notifications"
                onClick={() => setNotifDropdownOpen(prev => !prev)}
                aria-expanded={notifDropdownOpen}
              >
                <Icon d={ICONS.notifications} size={16} />
                {unreadCount > 0 && (
                  <span className="header-notif-count">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {notifDropdownOpen && (
                <>
                  {/* Transparent backdrop - closes dropdown on click */}
                  <div 
                    className="notif-backdrop" 
                    onClick={() => setNotifDropdownOpen(false)}
                    aria-hidden="true"
                  />
                  
                  <div className="header-notif-dropdown">
                    <div className="header-dropdown-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.9rem' }}>Notifications</div>
                      <button
                        onClick={handleMarkAllRead}
                        className="header-dropdown-link"
                      >
                        Mark all as read
                      </button>
                    </div>
                    <div className="header-dropdown-divider" style={{ margin: 0 }} />

                    <div className="notif-dropdown-list">
                      {recentNotifs.length > 0 ? (
                        recentNotifs.map(n => (
                          <div
                            key={n.id}
                            className={`notif-dropdown-item ${!n.is_read ? 'unread' : ''}`}
                            onClick={() => handleNotifClick(n)}
                            style={{ cursor: 'pointer' }}
                          >
                            <div className="notif-dropdown-icon">
                              <Icon d={ICONS.notifications} size={16} />
                            </div>
                            <div className="notif-dropdown-content" style={{ flex: 1, minWidth: 0 }}>
                              <div className="notif-dropdown-text">
                                {n.title && <span style={{ fontWeight: 600, display: 'block', marginBottom: '0.15rem' }}>{n.title}</span>}
                                <span style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  lineHeight: 1.35,
                                  fontSize: '0.8rem',
                                  color: 'var(--text-sub)',
                                }}>
                                  {n.message}
                                </span>
                              </div>
                              <div className="notif-dropdown-time" style={{ marginTop: '0.25rem', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                {formatRelativeTime(n.created_at)}
                              </div>
                            </div>
                            {!n.is_read && <div className="notif-dropdown-dot" />}
                          </div>
                        ))
                      ) : (
                        <div className="notif-dropdown-empty">
                          No notifications
                        </div>
                      )}
                    </div>

                    <div className="header-dropdown-divider" style={{ margin: 0 }} />
                    <div style={{ padding: '0.4rem' }}>
                      <Link
                        to={user?.role === 'admin' ? '/admin/announcements' : '/notifications'}
                        className="header-dropdown-link"
                        style={{ display: 'block', textAlign: 'center', padding: '0.5rem', fontWeight: 600 }}
                        onClick={() => setNotifDropdownOpen(false)}
                      >
                        View all
                      </Link>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="header-user-wrapper" ref={dropdownRef}>
              <button
                className={`header-user-btn ${dropdownOpen ? 'active' : ''}`}
                onClick={() => setDropdownOpen((prev) => !prev)}
                aria-expanded={dropdownOpen}
                aria-label="User menu"
                title={user?.name || 'User menu'}
              >
                {renderAvatar('header-avatar')}
                <Icon d={ICONS.chevronDown} size={14} />
              </button>

              {dropdownOpen && (
                <div className="header-user-dropdown">
                  <div className="header-dropdown-info">
                    <div className="header-dropdown-name">{user?.name}</div>
                    <div className="header-dropdown-role">{ROLE_LABELS[user?.role]}</div>
                    {userMeta && (
                      <div className="header-dropdown-role" style={{ marginTop: '0.1rem' }}>
                        {userMeta}
                      </div>
                    )}
                  </div>
                  <div className="header-dropdown-divider" />
                  <Link
                    to="/profile"
                    className="header-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Icon d={ICONS.profile} size={15} />
                    My Profile
                  </Link>
                  <Link
                    to="/settings"
                    className="header-dropdown-item"
                    onClick={() => setDropdownOpen(false)}
                  >
                    <Icon d={ICONS.settings} size={15} />
                    Settings
                  </Link>
                  <div className="header-dropdown-divider" />
                  <button
                    className="header-dropdown-item danger"
                    onClick={handleLogout}
                  >
                    <Icon d={ICONS.logout} size={15} />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className={`dashboard-page-body ${FROZEN_INVENTORY_PAGES.includes(location.pathname) ? 'dashboard-page-body--no-scroll' : ''}`}>
          {stats.length > 0 && (
            <div className={`stats-grid ${(user?.role === 'student' || user?.role === 'faculty_staff') && stats.length === 3 ? 'stats-grid--three' : ''}`}>
              {stats.map((s) => {
                const CardTag = s.to ? Link : 'div'
                return (
                  <CardTag
                    key={s.label}
                    to={s.to}
                    className="stat-card"
                    style={s.to ? { textDecoration: 'none', color: 'inherit', cursor: 'pointer' } : undefined}
                  >
                    {s.icon && (
                      <div className="stat-icon-badge">
                        <NavIcon name={s.icon} fallback="dashboard" size={20} />
                      </div>
                    )}
                    <div className="stat-info">
                      <span className="stat-value">{s.value}</span>
                      <span className="stat-label">{s.label}</span>
                    </div>
                  </CardTag>
                )
              })}
            </div>
          )}

          <div className={`dashboard-content-card ${FROZEN_INVENTORY_PAGES.includes(location.pathname) ? 'dashboard-content-card--no-scroll' : ''}`}>
            <Suspense fallback={<PageFallback />}>
            <Outlet context={{ setPageInfo }} />
          </Suspense>
          </div>
        </div>
      </main>

      {/* Chatbot widget — students and faculty/staff only */}
      {user && (user.role === 'student' || user.role === 'faculty_staff') && <ChatbotWidget />}

      {/* ── Mobile Bottom Navigation ─────────────────────────────── */}
      <nav className="mobile-bottom-nav" ref={bottomNavRef}>
        {navSections[0]?.items.slice(0, 3).map(item => {
          const isExact = Boolean(item.end || item.to === '/clinic/inventory');
          // Shorten labels
          let label = item.label;
          if (label === 'My Health Records' || label === 'Medical Records') label = 'Records';
          if (label === 'Dental Appointments' || label === 'Manage Appointments') label = 'Appts';
          if (label === 'Patient Directory') label = 'Patients';
          if (label === 'My Appointments') label = 'Appts';
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={isExact}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <NavIcon name={item.icon} size={22} />
              <span>{label}</span>
            </NavLink>
          );
        })}
        <NavLink
          to="/notifications"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <div style={{ position: 'relative' }}>
            <Icon d={ICONS.notifications} size={22} />
            {unreadCount > 0 && <span className="bottom-nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
          </div>
          <span>Alerts</span>
        </NavLink>
        <NavLink
          to="/profile"
          className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
        >
          <Icon d={ICONS.profile} size={22} />
          <span>Profile</span>
        </NavLink>
      </nav>

      {/* Announcement / Event Detail Modal */}
      {viewingAnnouncement && (
        <EventDetailsModal
          notification={viewingAnnouncement}
          onClose={() => setViewingAnnouncement(null)}
        />
      )}
    </div>
  )
}
