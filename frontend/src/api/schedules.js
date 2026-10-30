import api from './axios'

export const schedulesApi = {
  list:                  (params)     => api.get('/clinic/schedules', { params }),
  create:                (data)       => api.post('/clinic/schedules', data),
  update:                (id, data)   => api.put(`/clinic/schedules/${id}`, data),
  remove:                (id)         => api.delete(`/clinic/schedules/${id}`),
  slots:                 (params)     => api.get('/clinic/schedules/slots', { params }),
  listUnavailability:    (params)     => api.get('/clinic/schedules/unavailability', { params }),
  addUnavailability:     (data)       => api.post('/clinic/schedules/unavailability', data),
  removeUnavailability:  (id)         => api.delete(`/clinic/schedules/unavailability/${id}`),
}
