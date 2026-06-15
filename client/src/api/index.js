import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('selp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('selp_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Auth
export const login = (email, password) => api.post('/auth/login', { email, password });
export const getMe = () => api.get('/auth/me');
export const changePassword = (data) => api.post('/auth/change-password', data);

// Programs
export const getPrograms = () => api.get('/programs');
export const createProgram = (data) => api.post('/programs', data);
export const getProgram = (id) => api.get(`/programs/${id}`);
export const updateProgram = (id, data) => api.patch(`/programs/${id}`, data);
export const addMember = (programId, data) => api.post(`/programs/${programId}/members`, data);
export const removeMember = (programId, userId) => api.delete(`/programs/${programId}/members/${userId}`);

// Groups
export const getGroups = (programId) => api.get(`/programs/${programId}/groups`);
export const createGroup = (programId, data) => api.post(`/programs/${programId}/groups`, data);
export const updateGroup = (programId, groupId, data) => api.patch(`/programs/${programId}/groups/${groupId}`, data);
export const deleteGroup = (programId, groupId) => api.delete(`/programs/${programId}/groups/${groupId}`);

// Participants
export const getParticipants = (programId) => api.get(`/programs/${programId}/participants`);
export const createParticipant = (programId, data) => api.post(`/programs/${programId}/participants`, data);
export const getParticipant = (id) => api.get(`/participants/${id}`);
export const updateParticipant = (id, data) => api.patch(`/participants/${id}`, data);
export const moveParticipant = (id, groupId) => api.patch(`/participants/${id}/move`, { groupId });
export const deleteParticipant = (id) => api.delete(`/participants/${id}`);

// Projects
export const getProject = (participantId) => api.get(`/participants/${participantId}/project`);
export const upsertProject = (participantId, data) => api.put(`/participants/${participantId}/project`, data);
export const addUpdate = (projectId, data) => api.post(`/projects/${projectId}/updates`, data);
export const addComment = (projectId, data) => api.post(`/projects/${projectId}/comments`, data);
export const addVideo = (projectId, data) => api.post(`/projects/${projectId}/videos`, data);
export const uploadPhoto = (projectId, file, updateId) => {
  const fd = new FormData();
  fd.append('photo', file);
  if (updateId) fd.append('updateId', updateId);
  return api.post(`/projects/${projectId}/photos`, fd);
};

// Search
export const search = (programId, q, type) => api.get(`/programs/${programId}/search`, { params: { q, type } });

// Import
export const importPreview = (programId, file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post(`/programs/${programId}/import/preview`, fd);
};
export const importCommit = (programId, file, groupId) => {
  const fd = new FormData();
  fd.append('file', file);
  if (groupId) fd.append('groupId', groupId);
  return api.post(`/programs/${programId}/import/commit`, fd);
};

// Audit
export const getAuditLog = (programId) => api.get(`/programs/${programId}/audit`);
