import { useEffect, useSyncExternalStore } from 'react'
import { countersApi } from '../api/counters'
import { notificationsApi } from '../api/notifications'
import { poll } from '../utils/polling'

/**
 * Header badges (notifications, appointment requests, unread chat) for the whole app.
 *
 * One shared store and ONE request for all of them, no matter how many components read it
 * (the header, the sidebar and the chat bubble). It polls every 45 seconds while the tab is
 * visible, and refreshes at once when the app announces a change with one of the
 * 'notifications-updated', 'appointments-updated' or 'messages-updated' window events.
 */

const POLL_MS = 45_000
const NOTIF_POLL_MS = 2_500
const EVENTS = ['notifications-updated', 'appointments-updated', 'messages-updated']

const INITIAL = {
  loaded: false,
  notifications: { unread_count: 0, recent: [] },
  appointments: { unread_count: 0, medical_unread_count: 0, dental_unread_count: 0 },
  chat: { unread_count: 0, enabled: true },
}

let state = INITIAL
let subscribers = 0
let stopPolling = null
let stopFastPoll = null
let stopTimer = null
let refreshTimer = null
// Cursor for the fast notification poll: the id of the newest notification already seen.
let lastNotifId = 0
let notifPrimed = false
const listeners = new Set()

const emit = () => listeners.forEach((l) => l())

async function fetchCounters() {
  const { data } = await countersApi.get()
  state = {
    loaded: true,
    notifications: data.notifications ?? INITIAL.notifications,
    appointments: data.appointments ?? INITIAL.appointments,
    chat: data.chat ?? INITIAL.chat,
  }
  emit()
}

/** Refresh now (events from several components in the same moment become one request). */
export function refreshCounters() {
  if (!stopPolling) return
  clearTimeout(refreshTimer)
  refreshTimer = setTimeout(() => fetchCounters().catch(() => {}), 250)
}

/**
 * Fast notification poll (~every 2.5 s, visible tabs only — poll() pauses when hidden).
 * Asks the server only for notifications newer than the last seen id, so a tick is a
 * tiny indexed query. A fresh notification updates the badge right away and fires
 * 'notifications-updated', which makes the notification list reload live.
 */
async function fetchNotificationPoll() {
  const { data } = await notificationsApi.poll(lastNotifId)
  const items = data.notifications || data.data || []
  const unread = typeof data.unread_count === 'number' ? data.unread_count : null

  // Badge updates even when the change came from somewhere else (e.g. read on another device).
  if (unread !== null && unread !== state.notifications.unread_count) {
    state = { ...state, notifications: { ...state.notifications, unread_count: unread } }
    emit()
  }

  const previousCursor = lastNotifId
  lastNotifId = Math.max(lastNotifId, data.latest_id || 0, ...items.map((n) => n.id || 0))

  if (!notifPrimed) {
    // First tick only sets the cursor — everything already listed is not "new".
    notifPrimed = true
    return
  }

  // Anything newer than the previous cursor arrived since the last tick.
  if (lastNotifId > previousCursor || items.some((n) => n.id > previousCursor)) {
    window.dispatchEvent(new Event('notifications-updated'))
  }
}

function start() {
  clearTimeout(stopTimer)
  if (stopPolling) return
  stopPolling = poll(fetchCounters, POLL_MS)
  stopFastPoll = poll(fetchNotificationPoll, NOTIF_POLL_MS)
  EVENTS.forEach((e) => window.addEventListener(e, refreshCounters))
}

function stop() {
  // Wait a moment so React re-mounting a component (or StrictMode in development) does not
  // stop and restart the poll and cost an extra request.
  stopTimer = setTimeout(() => {
    stopPolling?.()
    stopPolling = null
    stopFastPoll?.()
    stopFastPoll = null
    lastNotifId = 0
    notifPrimed = false
    EVENTS.forEach((e) => window.removeEventListener(e, refreshCounters))
    clearTimeout(refreshTimer)
    state = INITIAL // the next user must not see this user's numbers
  }, 300)
}

function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const getSnapshot = () => state

/** Optimistically change the stored numbers (for example right after marking a notification read). */
export function patchCounters(updater) {
  state = { ...state, ...updater(state) }
  emit()
}

/**
 * @returns the latest counters. `enabled` (default true) lets a component opt out, for
 * example when the user is not logged in or the role has no use for them.
 */
export function useCounters(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined
    subscribers += 1
    start()
    return () => {
      subscribers -= 1
      if (subscribers === 0) stop()
    }
  }, [enabled])

  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}
