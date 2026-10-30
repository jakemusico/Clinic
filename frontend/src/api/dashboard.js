import api from './axios'

export const dashboardApi = {
  admin:   (params) => api.get('/dashboard/admin', { params }),
  nurse:   (params) => api.get('/dashboard/nurse', { params }),
  dentist: (params) => api.get('/dashboard/dentist', { params }),
}
