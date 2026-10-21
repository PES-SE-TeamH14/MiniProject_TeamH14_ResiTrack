import { useContext } from 'react';
import AuthContext from './AuthContext.js';

/** Returns { user, login, logout }. user is null when nobody is logged in. */
export default function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return auth;
}
