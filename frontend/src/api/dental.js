import api from './axios'

export const dentalApi = {
  listConsultations: (params) => api.get('/dental/consultations', { params }),
  getConsultation:  (id)     => api.get(`/dental/consultations/${id}`),
  createConsultation:(data)   => api.post('/dental/consultations', data),
  updateConsultation:(id, data) => api.put(`/dental/consultations/${id}`, data),

  getChart:    (patientId) => api.get(`/dental/chart/${patientId}`),
  updateTooth: (patientId, data) => api.post(`/dental/chart/${patientId}/tooth`, data),
}
