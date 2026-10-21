import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '../api/client.js';
import AuthContext from './AuthContext.js';
import { clearSession, getToken, getUser, onSessionChange, setSession } from './session.js';

// Someone is logged in only if both the token and the user are stored
function readSession() {
  return getToken() ? getUser() : null;
}

export default function AuthProvider({ children }) {
  const [user, setUser] = useState(readSession);

  // Stay in sync when the session changes (login, logout, or another browser tab)
  useEffect(() => onSessionChange(() => setUser(readSession())), []);

  const login = useCallback(async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    setSession(res.data.token, res.data.user);
    return res.data.user;
  }, []);

  const logout = useCallback(() => clearSession(), []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
