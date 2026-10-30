import api from './axios'

export const inventoryApi = {
  // Dashboard
  dashboard:    ()       => api.get('/inventory/dashboard'),
  alertSummary: ()       => api.get('/inventory/alert-summary'),
  dispensable:  ()       => api.get('/inventory/dispensable'),
  consultationItems: (type, id) =>
    api.get('/inventory/consultation-items', { params: { consultation_type: type, consultation_id: id } }),

  // Items
  listItems:   (params)           => api.get('/inventory/items', { params }),
  createItem:  (payload)          => api.post('/inventory/items', payload),
  updateItem:  (id, payload)      => api.put(`/inventory/items/${id}`, payload),
  toggleItem:  (id)               => api.patch(`/inventory/items/${id}/toggle`),

  // Batches (Stock In)
  listBatches:  (params)   => api.get('/inventory/batches', { params }),
  createBatch:  (payload)  => api.post('/inventory/batches', payload),

  // Transactions
  listTransactions: (params)  => api.get('/inventory/transactions', { params }),
  stockOut:         (payload) => api.post('/inventory/stock-out', payload),
}
