import api from './axios'
import { invalidate } from './referenceCache'
import { referenceApi } from './reference'

// Saving a consultation can dispense medicines, so the cached item/stock list is forgotten.
const stockMayHaveChanged = () => invalidate('inventory:')

export const recordsApi = {
  list:     (params)   => api.get('/clinic/records', { params }),
  get:      (id)       => api.get(`/clinic/records/${id}`),
  create:   (data)     => api.post('/clinic/records', data).finally(stockMayHaveChanged),
  update:   (id, data) => api.put(`/clinic/records/${id}`, data).finally(stockMayHaveChanged),
  // Always from the server (patient directories, search)
  patients: (params)   => api.get('/clinic/patients', { params }),
  // The full list for the "choose a patient" picker of the consultation forms: kept for a minute,
  // so opening a form again does not download everybody again.
  patientPickList: ()  => referenceApi.patients(),
}
