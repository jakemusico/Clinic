import api from './axios'

export const calendarApi = {
  list:   (params) => api.get('/calendar-events', { params }),
  create: (data)   => api.post('/calendar-events', data),
  update: (id, data) => api.put(`/calendar-events/${id}`, data),
  delete: (id)     => api.delete(`/calendar-events/${id}`),
}
