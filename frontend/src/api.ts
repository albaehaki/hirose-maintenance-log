import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // kirim cookie sesi
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && !location.pathname.startsWith('/login')) {
      location.href = '/login';
    }
    return Promise.reject(err);
  },
);
