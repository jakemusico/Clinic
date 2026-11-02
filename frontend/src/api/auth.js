import api from './axios'

export const authApi = {
  register:       (data) => api.post('/auth/register', data),
  login:          (data) => api.post('/auth/login', data),
  logout:         ()     => api.post('/auth/logout'),
  me:             ()     => api.get('/auth/me'),
  getProfile:     ()     => api.get('/profile'),
  updateProfile:  (data) => api.put('/profile', data),
  changePassword: (data) => api.post('/auth/change-password', data),

  // Profile photo: sent as a multipart file, never as base64.
  // The explicit multipart header is required: the axios instance defaults to
  // application/json, which would make axios serialise FormData to JSON.
  uploadPhoto:    (formData) => api.post('/profile/photo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  removePhoto:    ()     => api.delete('/profile/photo'),
}
