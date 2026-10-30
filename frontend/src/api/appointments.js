import api from './axios'

export const appointmentsApi = {
  list:           (params) => api.get('/appointments', { params }),
  unreadCount:    ()       => api.get('/appointments/unread-count'),
  markAllRead:    (data)   => api.post('/appointments/mark-read', data),
  markRead:       (id)     => api.patch(`/appointments/${id}/read`),
  create:         (data)   => api.post('/appointments', data),
  reschedule:     (id, data) => api.put(`/appointments/${id}/reschedule`, data),
  updateStatus:   (id, data) => api.patch(`/appointments/${id}/status`, data),
  staffList:      (params) => api.get('/clinic/staff-list', { params }),
  slots:          (params) => api.get('/appointments/slots', { params }),
  availableDates: (params) => api.get('/appointments/available-dates', { params }),
}
