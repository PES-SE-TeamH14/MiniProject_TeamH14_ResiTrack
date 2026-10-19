import { Routes, Route } from 'react-router-dom';
import VisitorsPage from './pages/admin/VisitorsPage.jsx';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import FlatsPage from './pages/admin/FlatsPage.jsx';

// Pages for each role (login, admin, resident, maintenance, owner) are added
// here as their backlog items are built.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin/flats" element={<FlatsPage />} />
	<Route path="/admin/visitors" element={<VisitorsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
