import api from './axios'

export const notificationsApi = {
  list:     ()           => api.get('/notifications'),
  read:     (id)         => api.patch(`/notifications/${id}/read`),
  unread:   (id)         => api.patch(`/notifications/${id}/unread`),
  delete:   (id)         => api.delete(`/notifications/${id}`),
  readAll:  ()           => api.post('/notifications/read-all'),
  announce: (data)       => api.post('/notifications/announce', data),
}
