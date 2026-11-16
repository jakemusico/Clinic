import api from './axios'
import { cached, invalidate } from './referenceCache'

// The notification list is cached briefly for fast tab switches; poll() stays
// uncached because it is a freshness check. Writes forget the list + dashboards.
const refresh = (r) => { invalidate('notifications'); invalidate('dashboard'); return r }

export const notificationsApi = {
  list:     ()           => cached('notifications:list', 30 * 1000, () => api.get('/notifications')),
  poll:     (since = 0)    => api.get('/notifications/poll', { params: { since } }),
  read:     (id)         => api.patch(`/notifications/${id}/read`).then(refresh),
  unread:   (id)         => api.patch(`/notifications/${id}/unread`).then(refresh),
  delete:   (id)         => api.delete(`/notifications/${id}`).then(refresh),
  readAll:  ()           => api.post('/notifications/read-all').then(refresh),
  announce: (data)       => api.post('/notifications/announce', data).then(refresh),
}
