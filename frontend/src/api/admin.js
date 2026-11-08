import api from './axios'
import { invalidate } from './referenceCache'
import { referenceApi } from './reference'

export const adminApi = {
  // Users management (the cached patient list changes with the accounts)
  listUsers: (params) =>
    api.get('/admin/users', { params }),

  createUser: (payload) =>
    api.post('/admin/users', payload).finally(() => invalidate('patients')),

  updateUser: (id, payload) =>
    api.put(`/admin/users/${id}`, payload).finally(() => invalidate('patients')),

  toggleUserStatus: (id) =>
    api.patch(`/admin/users/${id}/toggle`).finally(() => invalidate('patients')),

  // Audit Logs
  listAuditLogs: (params, config) =>
    api.get('/admin/audit-logs', { params, ...config }),

  // System Settings: reads are cached for a minute (see referenceCache.js); saving a setting forgets it
  getSetting: (key) =>
    referenceApi.setting(key),

  updateSetting: (key, value) =>
    api.put(`/admin/settings/${key}`, { value }).finally(() => invalidate(`setting:${key}`)),

  // Notification target resolution
  resolveNotificationTarget: (id) =>
    api.get(`/admin/notifications/${id}/target`),
}
