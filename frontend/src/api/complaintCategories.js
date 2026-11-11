import api from './axios'

export const complaintCategoriesApi = {
  // Active categories for the consultation form (admins get all of them).
  // Pass { type: 'medical' | 'dental' } to scope; admins may also filter admin lists.
  list:    (params) => api.get('/complaint-categories', { params }),

  // Admin management (/admin/complaint-categories, admin role only)
  create:  (data)       => api.post('/admin/complaint-categories', data),
  update:  (id, data)   => api.put(`/admin/complaint-categories/${id}`, data),
  toggle:  (id)         => api.patch(`/admin/complaint-categories/${id}/toggle`),
  reorder: (ids)        => api.post('/admin/complaint-categories/reorder', { ids }),
}
