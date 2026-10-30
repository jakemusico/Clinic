import api from './axios'

export const authApi = {
  register:       (data) => api.post('/auth/register', data),
  login:          (data) => api.post('/auth/login', data),
  logout:         ()     => api.post('/auth/logout'),
  me:             ()     => api.get('/auth/me'),
  getProfile:     ()     => api.get('/profile'),
  updateProfile:  (data) => api.put('/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),
}
