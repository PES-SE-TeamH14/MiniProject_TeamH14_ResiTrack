import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import useAuth from '../auth/useAuth.js';

const navClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

// Each link is shown only to the roles that can use that page (FR-14)
const LINKS = [
  { to: '/admin/flats', label: 'Flats', roles: ['admin'] },
  { to: '/admin/tenants', label: 'Tenants', roles: ['admin'] },
  { to: '/admin/rent', label: 'Rent', roles: ['admin'] },
  { to: '/admin/visitors', label: 'Visitors', roles: ['admin'] },
  { to: '/admin/documents', label: 'Documents', roles: ['admin'] },
  { to: '/complaints', label: 'Complaints', roles: ['resident', 'admin', 'maintenance'] },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app">
      <header className="app-header">
        <div className="brand-block">
          <Link to="/" className="brand">ResiTrack</Link>
          <span className="tagline">Apartment / Residencies Organizer</span>
        </div>
        <nav className="nav">
          <NavLink to="/" end className={navClass}>
            Home
          </NavLink>
          {user &&
            LINKS.filter((link) => link.roles.includes(user.role)).map((link) => (
              <NavLink key={link.to} to={link.to} className={navClass}>
                {link.label}
              </NavLink>
            ))}
          {user ? (
            <>
              <span className="nav-user">
                {user.name} <span className="nav-role">({user.role})</span>
              </span>
              <button type="button" className="btn btn-small" onClick={handleLogout}>
                Logout
              </button>
            </>
          ) : (
            <NavLink to="/login" className={navClass}>
              Log in
            </NavLink>
          )}
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
