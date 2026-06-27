import axios from 'axios'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_URL}/api/v1`,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sm_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('sm_token')
      localStorage.removeItem('sm_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export const authApi = {
  register: (data) => api.post('/auth/register', data),
  login:    (data) => api.post('/auth/login', data),
  getMe:    ()     => api.get('/auth/me'),
}

export const emotionsApi = {
  list:  ()    => api.get('/emotions'),
  log:   (key) => api.post('/emotions/log', { emotion_key: key }),
  today: ()    => api.get('/emotions/today'),
}

export const scenariosApi = {
  list:     ()   => api.get('/scenarios'),
  get:      (id) => api.get(`/scenarios/${id}`),
  complete: (id) => api.post(`/scenarios/${id}/complete`),
}

export const chatApi = {
  start:           (emotion_key)  => api.post('/chat/start', { emotion_key }),
  sendMessage:     (id, content)  => api.post(`/chat/${id}/message`, { content }),
  getHistory:      ()             => api.get('/chat/history'),
  getConversation: (id)           => api.get(`/chat/${id}`),
}

export const calmApi = {
  saveSession: (activity_type, duration_seconds, emotion_key) =>
    api.post('/calma/session', { activity_type, duration_seconds, emotion_key }),
  getPhrase:   (emotionKey) => api.post('/calma/phrase', { emotion_key: emotionKey }),
}

export const panelApi = {
  listChildren: ()          => api.get('/panel/children'),
  getChild:     (childId)   => api.get(`/panel/children/${childId}`),
  saveNote:     (childId, content) =>
    api.put(`/panel/children/${childId}/note`, { content }),
}

export const bibliotecaApi = {
  upload: (formData) =>
    api.post('/biblioteca/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  list:   ()      => api.get('/biblioteca/documents'),
  delete: (docId) => api.delete(`/biblioteca/documents/${docId}`),
}

export const gamificationApi = {
  getProgress: () => api.get('/gamification/progreso'),
}

export const profilesApi = {
  getMe:       () => api.get('/profiles/me'),
  createChild: (data) => api.post('/profiles/children', data),
}
