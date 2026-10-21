import { Navigate, Outlet } from 'react-router-dom';
import useAuth from '../auth/useAuth.js';
import { homePathFor } from '../auth/roles.js';

// Wraps pages that need a login. Logged-out users go to /login;
// users whose role may not see the page go to their own dashboard. The API enforces the same rules (FR-14).
export default function RequireAuth({ roles }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(user.role)) {
    return <Navigate to={homePathFor(user.role)} replace />;
  }
  return <Outlet />;
}
