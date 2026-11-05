import api from './axios'

export const servicesApi = {
  // params: { care_type: 'medical' | 'dental', active: 1 }  (filtered by the API)
  list:   (params)     => api.get('/clinic/services', { params }),
  get:    (id)         => api.get(`/clinic/services/${id}`),
  create: (data)       => api.post('/clinic/services', data),
  update: (id, data)   => api.put(`/clinic/services/${id}`, data),
  toggle: (id)         => api.patch(`/clinic/services/${id}/toggle`),
  remove: (id)         => api.delete(`/clinic/services/${id}`),
}
