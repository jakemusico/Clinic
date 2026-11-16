import api from './axios'
import { cached, invalidate } from './referenceCache'

// Dashboard payloads are the heaviest reads in the app. Cache them for 60 s so
// switching between dashboard tabs is instant; any appointment/notification/
// record write invalidates the 'dashboard' prefix (see those api modules).
const dashKey = (name, params) => `dashboard:${name}:${JSON.stringify(params || {})}`
const TTL = 60 * 1000

export const dashboardApi = {
  admin:   (params, config) => cached(dashKey('admin', params), TTL, () => api.get('/dashboard/admin', { params, ...config })),
  nurse:   (params, config) => cached(dashKey('nurse', params), TTL, () => api.get('/dashboard/nurse', { params, ...config })),
  dentist: (params, config) => cached(dashKey('dentist', params), TTL, () => api.get('/dashboard/dentist', { params, ...config })),
  /** Student and faculty/staff dashboard: stats, appointments, notifications, announcements, events */
  student: (config) => cached('dashboard:student', TTL, () => api.get('/dashboard/student', config)),
}

export { invalidate as invalidateDashboardCache }
