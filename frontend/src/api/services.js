import api from './axios'

export const servicesApi = {
  list:   ()           => api.get('/clinic/services'),
  get:    (id)         => api.get(`/clinic/services/${id}`),
  create: (data)       => api.post('/clinic/services', data),
  update: (id, data)   => api.put(`/clinic/services/${id}`, data),
  toggle: (id)         => api.patch(`/clinic/services/${id}/toggle`),
  remove: (id)         => api.delete(`/clinic/services/${id}`),
}
