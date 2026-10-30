import api from './axios'

export const recordsApi = {
  list:     (params)   => api.get('/clinic/records', { params }),
  get:      (id)       => api.get(`/clinic/records/${id}`),
  create:   (data)     => api.post('/clinic/records', data),
  update:   (id, data) => api.put(`/clinic/records/${id}`, data),
  patients: (params)   => api.get('/clinic/patients', { params }),
}
