import { Link, Outlet } from 'react-router-dom';

export default function Layout() {
  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand">ResiTrack</Link>
        <span className="tagline">Apartment / Residencies Organizer</span>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
