import api from './axios'

export const chatApi = {
  getStatus: (staffRole) =>
    api.get(`/chat/status/${staffRole}`),

  heartbeat: () =>
    api.post('/chat/heartbeat'),

  getStudentConversation: (staffRole) =>
    api.get(`/chat/student/conversation?staff_role=${staffRole}`),

  getStudentUnreadCount: () =>
    api.get('/chat/student/unread-count'),

  markStudentAllRead: () =>
    api.post('/chat/student/read-all'),

  listConversations: (status) =>
    api.get('/chat/conversations', { params: status ? { status } : {} }),

  getConversation: (id) =>
    api.get(`/chat/conversations/${id}`),

  sendMessage: (conversationId, body, clientId, config) =>
    api.post(`/chat/conversations/${conversationId}/messages`, { body, client_id: clientId }, config),

  unsendMessage: (messageId) =>
    api.delete(`/chat/messages/${messageId}`),

  updateMessage: (messageId, body) =>
    api.patch(`/chat/messages/${messageId}`, { body }),

  updateStatus: (conversationId, status) =>
    api.patch(`/chat/conversations/${conversationId}/status`, { status }),

  getUnreadCount: () =>
    api.get('/chat/unread-count'),

  getAdminStats: () =>
    api.get('/chat/admin/stats'),
}
