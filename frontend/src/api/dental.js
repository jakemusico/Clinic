import api from './axios'
import { invalidate } from './referenceCache'

// Saving a consultation can dispense medicines, so the cached item/stock list is forgotten.
const stockMayHaveChanged = () => invalidate('inventory:')

export const dentalApi = {
  listConsultations: (params) => api.get('/dental/consultations', { params }),
  getConsultation:  (id)     => api.get(`/dental/consultations/${id}`),
  createConsultation:(data)   => api.post('/dental/consultations', data).finally(stockMayHaveChanged),
  updateConsultation:(id, data) => api.put(`/dental/consultations/${id}`, data).finally(stockMayHaveChanged),

  getChart:    (patientId) => api.get(`/dental/chart/${patientId}`),
  updateTooth: (patientId, data) => api.post(`/dental/chart/${patientId}/tooth`, data),
}
