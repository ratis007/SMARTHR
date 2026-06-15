import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('smarthr_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;

  // Multi-tenant : injecte X-Company-ID si un espace entreprise est actif.
  // window.__activeCompanyId est positionné par CompanyContext.
  const cid = window.__activeCompanyId;
  if (cid) config.headers['X-Company-ID'] = cid;

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('smarthr_token');
      localStorage.removeItem('smarthr_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;

// Helper: normalise la réponse paginée ou tableau en tableau simple
const toArray = (res) => {
  const d = res.data;
  // Si l'API retourne {data: [], total, page} → extraire .data
  if (d && Array.isArray(d.data)) return { ...res, data: d.data, meta: { total: d.total, page: d.page, totalPages: d.totalPages } };
  // Si l'API retourne directement un tableau
  return res;
};

export const authApi = {
  login: (data) => api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const companiesApi = {
  getAll: () => api.get('/companies'),
  getOne: (id) => api.get(`/companies/${id}`),
  create: (data) => api.post('/companies', data),
  update: (id, data) => api.put(`/companies/${id}`, data),
  toggleStatus: (id) => api.patch(`/companies/${id}/toggle-status`),
  activate: (id) => api.patch(`/companies/${id}/activate`),
  archive: (id) => api.patch(`/companies/${id}/archive`),
  delete: (id) => api.delete(`/companies/${id}`),
};

export const employeesApi = {
  // Retourne toujours un tableau (compatibilité avec les pages existantes)
  getAll: (companyId, search) =>
    api.get('/employees', { params: { companyId, search, limit: 1000 } }).then(toArray),
  // Pagination complète pour les pages avancées
  getPaginated: (params) =>
    api.get('/employees', { params }).then((res) => res.data),
  getOne: (id) => api.get(`/employees/${id}`),
  getDossier: (id) => api.get(`/employees/${id}/dossier`),
  getStats: () => api.get('/employees/stats'),
  create: (data) => api.post('/employees', data),
  update: (id, data) => api.put(`/employees/${id}`, data),
  toggleStatus: (id) => api.patch(`/employees/${id}/toggle-status`),
  activate: (id) => api.patch(`/employees/${id}/activate`),
  deactivate: (id) => api.patch(`/employees/${id}/deactivate`),
  delete: (id) => api.delete(`/employees/${id}`),
};

export const contractsApi = {
  getAll: (companyId) => api.get('/contracts', { params: { ...(companyId ? { companyId } : {}) } }),
  getOne: (id) => api.get(`/contracts/${id}`),
  create: (data) => api.post('/contracts', data),
  update: (id, data) => api.put(`/contracts/${id}`, data),
  toggleStatus: (id) => api.patch(`/contracts/${id}/toggle-status`),
  activate: (id) => api.patch(`/contracts/${id}/activate`),
  deactivate: (id) => api.patch(`/contracts/${id}/deactivate`),
  delete: (id) => api.delete(`/contracts/${id}`),
};

export const payrollApi = {
  getAll: (month, year, companyId) =>
    api.get('/payroll', { params: { month, year, limit: 1000, ...(companyId ? { companyId } : {}) } }).then(toArray),
  getOne: (id) => api.get(`/payroll/${id}`),
  getSummary: (month, year, companyId) => api.get('/payroll/summary', { params: { month, year, ...(companyId ? { companyId } : {}) } }),
  generate: (data) => api.post('/payroll/generate', data),
  update: (id, data) => api.put(`/payroll/${id}`, data),
  validate: (id) => api.put(`/payroll/${id}/validate`),
  toggleStatus: (id) => api.patch(`/payroll/${id}/toggle-status`),
  activate: (id) => api.patch(`/payroll/${id}/activate`),
  deactivate: (id) => api.patch(`/payroll/${id}/deactivate`),
  delete: (id) => api.delete(`/payroll/${id}`),
};

export const leaveApi = {
  getAll: (companyId) =>
    api.get('/leave', { params: { limit: 1000, ...(companyId ? { companyId } : {}) } }).then(toArray),
  getPending: (companyId) => api.get('/leave/pending', { params: companyId ? { companyId } : {} }),
  create: (data) => api.post('/leave', data),
  approve: (id) => api.put(`/leave/${id}/approve`),
  reject: (id) => api.put(`/leave/${id}/reject`),
  delete: (id) => api.delete(`/leave/${id}`),
};

export const reportsApi = {
  getDashboard: (companyId) => api.get('/reports/dashboard', { params: companyId ? { companyId } : {} }),
  getPayroll: (month, year, companyId) => api.get('/reports/payroll', { params: { month, year, ...(companyId ? { companyId } : {}) } }),
  getLeave: (year, companyId) => api.get('/reports/leave', { params: { year, ...(companyId ? { companyId } : {}) } }),
};

export const usersApi = {
  getAll: () => api.get('/users'),
  create: (data) => api.post('/users', data),
  update: (id, data) => api.put(`/users/${id}`, data),
  setStatus: (id, status) => api.patch(`/users/${id}/status`, { status }),
  resetPassword: (id, password) => api.post(`/users/${id}/reset-password`, { password }),
  delete: (id) => api.delete(`/users/${id}`),
  roles: () => api.get('/users/roles'),
  updateRole: (id, data) => api.put(`/users/roles/${id}`, data),
  permissions: () => api.get('/users/permissions'),
  auditLogs: (userId) => api.get('/users/audit-logs', { params: userId ? { userId } : {} }),
};

export const platformSettingsApi = {
  getCompanySettings: (companyId, type) => api.get(`/settings/companies/${companyId}`, { params: type ? { type } : {} }),
  createCompanySetting: (companyId, data) => api.post(`/settings/companies/${companyId}`, data),
  updateCompanySetting: (id, data) => api.put(`/settings/company-settings/${id}`, data),
  deleteCompanySetting: (id) => api.delete(`/settings/company-settings/${id}`),
  getCurrency: (companyId) => api.get(`/settings/companies/${companyId}/currency`),
  updateCurrency: (companyId, data) => api.put(`/settings/companies/${companyId}/currency`, data),
  fetchCurrencyRate: (companyId) => api.post(`/settings/companies/${companyId}/currency/fetch-rate`),
  convert: (companyId, amount, from) => api.get(`/settings/companies/${companyId}/currency/convert`, { params: { amount, from } }),
  rateHistory: (companyId) => api.get(`/settings/companies/${companyId}/currency/history`),
};
