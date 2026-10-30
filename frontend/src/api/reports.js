import api from './axios'

export const reportsApi = {
  appointmentSummary: (params) =>
    api.get('/reports/appointments', { params }),
  consultationSummary: (params) =>
    api.get('/reports/consultations', { params }),
  inventorySummary: (params) =>
    api.get('/reports/inventory', { params }),
  symptomsSummary: (params) =>
    api.get('/reports/frequent-symptoms', { params }),
  chatSummary: (params) =>
    api.get('/reports/chat', { params }),
  logExport: (data) =>
    api.post('/reports/log-export', data),
}

