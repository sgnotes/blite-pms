import axios from 'axios';
import { supabase } from './supabase.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api',
  headers: { 'Content-Type': 'application/json' },
});

// Inject Supabase JWT on every request
api.interceptors.request.use(async (config) => {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    config.headers.Authorization = `Bearer ${session.access_token}`;
  }
  return config;
});

// Handle 401s
api.interceptors.response.use(
  res => res,
  async (error) => {
    if (error.response?.status === 401) {
      await supabase.auth.signOut();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── API methods ───────────────────────────────────────────────

export const dashboardApi = {
  getSummary: (propertyId) => api.get(`/dashboard/summary?property_id=${propertyId}`),
};

export const tenantsApi = {
  list: (params) => api.get('/tenants', { params }),
  get: (id) => api.get(`/tenants/${id}`),
  create: (data) => api.post('/tenants', data),
  update: (id, data) => api.patch(`/tenants/${id}`, data),
  vacate: (id) => api.delete(`/tenants/${id}`),
  uploadKyc: (id, data) => api.post(`/tenants/${id}/kyc`, data),
};

export const roomsApi = {
  list: (params) => api.get('/rooms', { params }),
  get: (id) => api.get(`/rooms/${id}`),
  create: (data) => api.post('/rooms', data),
  update: (id, data) => api.patch(`/rooms/${id}`, data),
};

export const paymentsApi = {
  getLedger: (params) => api.get('/payments/ledger', { params }),
  createOrder: (ledgerId) => api.post('/payments/create-order', { ledger_id: ledgerId }),
  verifyPayment: (data) => api.post('/payments/verify', data),
  recordManual: (data) => api.post('/payments/record-manual', data),
  generateLedger: (data) => api.post('/payments/generate-ledger', data),
};

export const maintenanceApi = {
  list: (params) => api.get('/maintenance', { params }),
  get: (id) => api.get(`/maintenance/${id}`),
  create: (data) => api.post('/maintenance', data),
  update: (id, data) => api.patch(`/maintenance/${id}`, data),
};

export const deedsApi = {
  list: (params) => api.get('/rent-deeds', { params }),
  get: (id) => api.get(`/rent-deeds/${id}`),
  create: (data) => api.post('/rent-deeds', data),
  generatePdf: (id) => api.post(`/rent-deeds/${id}/generate-pdf`),
  sendForSign: (id) => api.post(`/rent-deeds/${id}/send-for-sign`),
};

export default api;
