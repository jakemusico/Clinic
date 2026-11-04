import api from './axios'

export const chatbotApi = {
  /** Send a user message; get a rule-based response */
  message: (message) =>
    api.post('/chatbot/message', { message }),

  /** Get the top-level category menu */
  menu: () =>
    api.get('/chatbot/menu'),

  /** Get all active FAQs in a category */
  category: (cat) =>
    api.get(`/chatbot/category/${cat}`),

  /** Get a single FAQ's full answer */
  faq: (id) =>
    api.get(`/chatbot/faqs/${id}`),

  /* ── Staff/Admin FAQ management ─────────────────────────────────── */
  /** List all FAQs (staff sees inactive too) */
  list: (params) =>
    api.get('/chatbot/faqs', { params }),

  /** Create a new FAQ */
  create: (payload) =>
    api.post('/chatbot/faqs', payload),

  /** Update an FAQ */
  update: (id, payload) =>
    api.put(`/chatbot/faqs/${id}`, payload),

  /** Delete an FAQ */
  delete: (id) =>
    api.delete(`/chatbot/faqs/${id}`),

  /** Toggle active/inactive */
  toggle: (id) =>
    api.patch(`/chatbot/faqs/${id}/toggle`),

  /** Show/hide an FAQ on the Student & Faculty Help page */
  toggleHelp: (id) =>
    api.patch(`/chatbot/faqs/${id}/help`),

  /** Admin Chatbot Support Statistics */
  getStatistics: (params) =>
    api.get('/chatbot/admin/statistics', { params }),
}
