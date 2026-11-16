import api from './axios'
import { cached, invalidate } from './referenceCache'

// List/dashboard reads are cached for a short window so navigating back to a
// tab paints instantly; every write below forgets the affected prefixes.
const apptKey = (params) => `appointments:list:${JSON.stringify(params || {})}`
const refresh = (r) => { invalidate('appointments'); invalidate('dashboard'); return r }

export const appointmentsApi = {
  list:           (params) => cached(apptKey(params), 30 * 1000, () => api.get('/appointments', { params })),
  unreadCount:    ()       => api.get('/appointments/unread-count'),
  markAllRead:    (data)   => api.post('/appointments/mark-read', data).then(refresh),
  markRead:       (id)     => api.patch(`/appointments/${id}/read`).then(refresh),
  create:         (data)   => api.post('/appointments', data).then(refresh),
  reschedule:     (id, data) => api.put(`/appointments/${id}/reschedule`, data).then(refresh),
  updateStatus:   (id, data) => api.patch(`/appointments/${id}/status`, data).then(refresh),
  staffList:      (params) => api.get('/clinic/staff-list', { params }),
  slots:          (params) => api.get('/appointments/slots', { params }),
  availableDates: (params) => api.get('/appointments/available-dates', { params }),
}
