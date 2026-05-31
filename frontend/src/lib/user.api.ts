// C:\Users\MSI\Desktop\Projet\pfe-project\frontend\src\lib\user.api.ts

import api from './api'

export const userApi = {
  getProfile: () => api.get('/users/me').then(r => r.data),
  updateProfile: (data: { nom?: string; avatarUrl?: string }) =>
    api.patch('/users/me', data).then(r => r.data),
  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    api.patch('/users/me/password', data).then(r => r.data),
}