import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api'
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('kh_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is stale/invalid (e.g. the underlying user no longer exists after a DB reseed),
// clear it and force a fresh login instead of leaving pages stuck silently "loading" forever.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && window.location.pathname !== '/login') {
      localStorage.removeItem('kh_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
