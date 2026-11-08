import api from './axios'

// `config` is optional (e.g. { signal } so a superseded request can be cancelled)
export const dashboardApi = {
  admin:   (params, config) => api.get('/dashboard/admin', { params, ...config }),
  nurse:   (params, config) => api.get('/dashboard/nurse', { params, ...config }),
  dentist: (params, config) => api.get('/dashboard/dentist', { params, ...config }),
  /** Student and faculty/staff dashboard: stats, appointments, notifications, announcements, events */
  student: (config) => api.get('/dashboard/student', config),
}
