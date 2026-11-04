import api from './axios'

export const inventoryApi = {
  // Dashboard
  dashboard:    ()       => api.get('/inventory/dashboard'),
  alertSummary: ()       => api.get('/inventory/alert-summary'),
  dispensable:  ()       => api.get('/inventory/dispensable'),
  consultationItems: (type, id) =>
    api.get('/inventory/consultation-items', { params: { consultation_type: type, consultation_id: id } }),

  // Items
  // Complete, never-paginated item list for dropdowns (includes zero-stock items)
  itemOptions: (params)           => api.get('/inventory/item-options', { params }),
  // `config` is optional (e.g. { signal } so a superseded request can be aborted)
  listItems:   (params, config)   => api.get('/inventory/items', { params, ...config }),
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
