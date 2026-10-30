import api from './axios'

export const announcementsApi = {
  list:    (params)     => api.get('/announcements', { params }),
  create:  (data)       => api.post('/announcements', data),
  update:  (id, data)   => api.put(`/announcements/${id}`, data),
  remove:  (id)         => api.delete(`/announcements/${id}`),
}
