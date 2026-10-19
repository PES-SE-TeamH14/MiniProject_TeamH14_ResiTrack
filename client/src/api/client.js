import axios from 'axios';

// One shared Axios instance for every API call (SAD §2.4).
// Feature code adds the auth token here once login (#3) is built.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Turn the server's { error: { code, message } } shape into a readable message
export function getErrorMessage(err) {
  return err?.response?.data?.error?.message || err.message || 'Request failed';
}

export default api;
