import api from './axios'

export const adminApi = {
  // Users management
  listUsers: (params) =>
    api.get('/admin/users', { params }),

  createUser: (payload) =>
    api.post('/admin/users', payload),

  updateUser: (id, payload) =>
    api.put(`/admin/users/${id}`, payload),

  toggleUserStatus: (id) =>
    api.patch(`/admin/users/${id}/toggle`),

  // Audit Logs
  listAuditLogs: (params) =>
    api.get('/admin/audit-logs', { params }),

  // System Settings
  getSetting: (key) =>
    api.get(`/settings/${key}`),

  updateSetting: (key, value) =>
    api.put(`/admin/settings/${key}`, { value }),

  // Notification target resolution
  resolveNotificationTarget: (id) =>
    api.get(`/admin/notifications/${id}/target`),
}
