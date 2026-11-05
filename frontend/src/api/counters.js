import api from './axios'

export const countersApi = {
  /**
   * Header and chat-bubble badges in one request:
   * { notifications: {unread_count, recent[]}, appointments: {...}, chat: {unread_count, enabled} }
   */
  get: () => api.get('/counters'),
}
