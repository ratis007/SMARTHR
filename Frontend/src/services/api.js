import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || '/api').replace(/\/+$/, '');

const api = axios.create({
  baseURL: API_URL,
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

export const employeeDocumentsApi = {
  config: (employeeId) => api.get(`/employees/${employeeId}/documents/config`),
  list: (employeeId) => api.get(`/employees/${employeeId}/documents`),
  upload: (employeeId, data) => api.post(`/employees/${employeeId}/documents`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  replace: (employeeId, documentId, data) => api.put(`/employees/${employeeId}/documents/${documentId}`, data, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  download: (employeeId, documentId) => api.get(`/employees/${employeeId}/documents/${documentId}/download`, {
    responseType: 'blob',
  }),
  exportZip: (employeeId) => api.get(`/employees/${employeeId}/documents/export`, {
    responseType: 'blob',
  }),
  delete: (employeeId, documentId) => api.delete(`/employees/${employeeId}/documents/${documentId}`),
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
  generateBatch: (data, companyId) => api.post('/payroll/generate-batch', data, { params: companyId ? { companyId } : {} }),
  getJob: (id) => api.get(`/payroll/jobs/${id}`),
  cancelJob: (id) => api.post(`/payroll/jobs/${id}/cancel`),
  payslip: (id) => api.get(`/payroll/${id}/payslip`, { responseType: 'blob' }),
  payslipExcel: (id) => api.get(`/payroll/${id}/payslip-excel`, { responseType: 'blob' }),
  archivePayslip: (id) => api.post(`/payroll/${id}/archive-payslip`),
  payrollDocuments: (id) => api.get(`/payroll/${id}/documents`),
  downloadPayrollDocument: (id, documentId) => api.get(`/payroll/${id}/documents/${documentId}/download`, { responseType: 'blob' }),
  exportJournal: (month, year, companyId) => api.get('/payroll/journal/export', {
    params: { month, year, ...(companyId ? { companyId } : {}) },
    responseType: 'blob',
  }),
  exportJournalExcel: (month, year, companyId) => api.get('/payroll/journal/export-excel', {
    params: { month, year, ...(companyId ? { companyId } : {}) },
    responseType: 'blob',
  }),
  exportJournalXlsx: (month, year, companyId) => api.get('/payroll/journal/export-xlsx', {
    params: { month, year, ...(companyId ? { companyId } : {}) },
    responseType: 'blob',
  }),
  exportBookExcel: (month, year, companyId) => api.get('/payroll/book/export-excel', {
    params: { month, year, ...(companyId ? { companyId } : {}) },
    responseType: 'blob',
  }),
  exportBookXlsx: (month, year, companyId) => api.get('/payroll/book/export-xlsx', {
    params: { month, year, ...(companyId ? { companyId } : {}) },
    responseType: 'blob',
  }),
  auditTrail: (month, year, companyId) => api.get('/payroll/audit-trail', {
    params: { month, year, ...(companyId ? { companyId } : {}) },
  }),
  preview: (data) => api.post('/payroll/engine/preview', data),
  configuration: (companyId) => api.get('/payroll/engine/configuration', { params: companyId ? { companyId } : {} }),
  createRubric: (data, companyId) => api.post('/payroll/engine/rubrics', data, { params: companyId ? { companyId } : {} }),
  createLegalRate: (data, companyId) => api.post('/payroll/engine/legal-rates', data, { params: companyId ? { companyId } : {} }),
  createIprBracket: (data, companyId) => api.post('/payroll/engine/ipr-brackets', data, { params: companyId ? { companyId } : {} }),
  periodStatus: (month, year, companyId) => api.get('/payroll/period/status', { params: { month, year, ...(companyId ? { companyId } : {}) } }),
  closePeriod: (data, companyId) => api.post('/payroll/period/close', data, { params: companyId ? { companyId } : {} }),
  reopenPeriod: (data, companyId) => api.post('/payroll/period/reopen', data, { params: companyId ? { companyId } : {} }),
  variables: (params) => api.get('/payroll/variables', { params }),
  createVariable: (data, companyId) => api.post('/payroll/variables', data, { params: companyId ? { companyId } : {} }),
  importVariablesCsv: (file, month, year, companyId) => {
    const data = new FormData();
    data.append('file', file);
    return api.post('/payroll/variables/import-csv', data, {
      params: { month, year, ...(companyId ? { companyId } : {}) },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  timeInputs: (params) => api.get('/payroll/time-inputs', { params }),
  createTimeInput: (data, companyId) => api.post('/payroll/time-inputs', data, { params: companyId ? { companyId } : {} }),
  importTimeInputsCsv: (file, month, year, companyId) => {
    const data = new FormData();
    data.append('file', file);
    return api.post('/payroll/time-inputs/import-csv', data, {
      params: { month, year, ...(companyId ? { companyId } : {}) },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  importTimeInputsExcel: (file, month, year, companyId) => {
    const data = new FormData();
    data.append('file', file);
    return api.post('/payroll/time-inputs/import-excel', data, {
      params: { month, year, ...(companyId ? { companyId } : {}) },
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  workflow: (id, status) => api.put(`/payroll/${id}/workflow/${status}`),
  update: (id, data) => api.put(`/payroll/${id}`, data),
  validate: (id) => api.put(`/payroll/${id}/validate`),
  toggleStatus: (id) => api.patch(`/payroll/${id}/toggle-status`),
  activate: (id) => api.patch(`/payroll/${id}/activate`),
  deactivate: (id) => api.patch(`/payroll/${id}/deactivate`),
  delete: (id) => api.delete(`/payroll/${id}`),
};

export const timeAttendanceApi = {
  configuration: (companyId) => api.get('/time-attendance/configuration', { params: companyId ? { companyId } : {} }),
  dashboard: (companyId, date) => api.get('/time-attendance/dashboard', { params: { ...(companyId ? { companyId } : {}), ...(date ? { date } : {}) } }),
  analytics: (params) => api.get('/time-attendance/analytics', { params }),
  days: (params) => api.get('/time-attendance/days', { params }),
  createWorkProfile: (data, companyId) => api.post('/time-attendance/work-profiles', data, { params: companyId ? { companyId } : {} }),
  createHoliday: (data, companyId) => api.post('/time-attendance/holidays', data, { params: companyId ? { companyId } : {} }),
  createTeam: (data, companyId) => api.post('/time-attendance/teams', data, { params: companyId ? { companyId } : {} }),
  createRotation: (data, companyId) => api.post('/time-attendance/rotations', data, { params: companyId ? { companyId } : {} }),
  assignWorkProfile: (data, companyId) => api.post('/time-attendance/assignments', data, { params: companyId ? { companyId } : {} }),
  createClockEvent: (data, companyId) => api.post('/time-attendance/clock-events', data, { params: companyId ? { companyId } : {} }),
  importClockEvents: (data, companyId) => api.post('/time-attendance/clock-events/import', data, { params: companyId ? { companyId } : {} }),
  calculate: (data, companyId) => api.post('/time-attendance/days/calculate', data, { params: companyId ? { companyId } : {} }),
  calculateAsync: (data, companyId) => api.post('/time-attendance/days/calculate/async', data, { params: companyId ? { companyId } : {} }),
  schedule: (params) => api.get('/time-attendance/schedule', { params }),
  generateSchedule: (data, companyId) => api.post('/time-attendance/schedule/generate', data, { params: companyId ? { companyId } : {} }),
  updateScheduleEntry: (id, data, companyId) => api.post(`/time-attendance/schedule/${id}`, data, { params: companyId ? { companyId } : {} }),
  alerts: (params) => api.get('/time-attendance/alerts', { params }),
  detectAlerts: (data, companyId) => api.post('/time-attendance/alerts/detect', data, { params: companyId ? { companyId } : {} }),
  detectAlertsAsync: (data, companyId) => api.post('/time-attendance/alerts/detect/async', data, { params: companyId ? { companyId } : {} }),
  updateAlert: (id, data, companyId) => api.post(`/time-attendance/alerts/${id}/status`, data, { params: companyId ? { companyId } : {} }),
  notificationOutbox: (params) => api.get('/time-attendance/notifications/outbox', { params }),
  dispatchNotifications: (data, companyId) => api.post('/time-attendance/notifications/dispatch', data, { params: companyId ? { companyId } : {} }),
  dispatchNotificationsAsync: (data, companyId) => api.post('/time-attendance/notifications/dispatch/async', data, { params: companyId ? { companyId } : {} }),
  retryNotification: (id, companyId) => api.post(`/time-attendance/notifications/${id}/retry`, {}, { params: companyId ? { companyId } : {} }),
  jobs: (params) => api.get('/time-attendance/jobs', { params }),
  job: (id, companyId) => api.get(`/time-attendance/jobs/${id}`, { params: companyId ? { companyId } : {} }),
  cancelJob: (id, companyId) => api.post(`/time-attendance/jobs/${id}/cancel`, {}, { params: companyId ? { companyId } : {} }),
  workflow: (id, status, companyId) => api.post(`/time-attendance/days/${id}/workflow/${status}`, {}, { params: companyId ? { companyId } : {} }),
  exportPayroll: (data, companyId) => api.post('/time-attendance/payroll/export', data, { params: companyId ? { companyId } : {} }),
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
  deleteAuditLog: (id) => api.delete(`/users/audit-logs/${id}`),
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
