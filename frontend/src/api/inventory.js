import api from './axios'
import { invalidate } from './referenceCache'
import { referenceApi } from './reference'

// The item pick list (with stock) is cached for 30 s. Anything this browser does that changes stock
// forgets it, success or not (a refused stock-out means the screen's numbers were out of date).
const stockChanged = () => invalidate('inventory:')

export const inventoryApi = {
  // Dashboard
  dashboard:    ()       => api.get('/inventory/dashboard'),
  alertSummary: ()       => api.get('/inventory/alert-summary'),
  dispensable:  ()       => api.get('/inventory/dispensable'),
  consultationItems: (type, id) =>
    api.get('/inventory/consultation-items', { params: { consultation_type: type, consultation_id: id } }),

  // Items
  // Complete, never-paginated item list for dropdowns (includes zero-stock items). Cached 30 s.
  itemOptions: (params)           => referenceApi.itemOptions(params),
  // `config` is optional (e.g. { signal } so a superseded request can be aborted)
  listItems:   (params, config)   => api.get('/inventory/items', { params, ...config }),
  createItem:  (payload)          => api.post('/inventory/items', payload).finally(stockChanged),
  updateItem:  (id, payload)      => api.put(`/inventory/items/${id}`, payload).finally(stockChanged),
  toggleItem:  (id)               => api.patch(`/inventory/items/${id}/toggle`).finally(stockChanged),

  // Batches (Stock In)
  listBatches:  (params)   => api.get('/inventory/batches', { params }),
  createBatch:  (payload)  => api.post('/inventory/batches', payload).finally(stockChanged),

  // Transactions
  listTransactions: (params)  => api.get('/inventory/transactions', { params }),
  stockOut:         (payload) => api.post('/inventory/stock-out', payload).finally(stockChanged),
}
