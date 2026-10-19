import { Link, NavLink, Outlet } from 'react-router-dom';

const navClass = ({ isActive }) => (isActive ? 'nav-link active' : 'nav-link');

export default function Layout() {
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
          <NavLink to="/admin/flats" className={navClass}>
            Flats
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
