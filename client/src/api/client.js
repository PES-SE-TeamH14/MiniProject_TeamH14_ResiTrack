
import axios from 'axios';
import { getToken, updateToken, clearSession } from '../auth/session.js';

// One shared Axios instance for every API call (SAD §2.4).
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Send the login token with every request (FR-02, FR-14).
api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Save the refreshed sliding-session token from authenticated responses.
function saveFreshToken(response) {
  const fresh = response?.headers?.['x-auth-token'];
  if (fresh) updateToken(fresh);
}

api.interceptors.response.use(
  (response) => {
    saveFreshToken(response);
    return response;
  },
  (error) => {
    saveFreshToken(error.response);

    if (
      error.response?.status === 401 &&
      error.response?.data?.error?.code === 'SESSION_EXPIRED'
    ) {
      clearSession();

      if (window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }

    return Promise.reject(error);
  },
);

// Turn the server's { error: { code, message } } shape into a readable message.
export function getErrorMessage(err) {
  return err?.response?.data?.error?.message || err.message || 'Request failed';
}

export default api;
