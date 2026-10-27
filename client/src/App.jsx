import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import RequireAuth from './components/RequireAuth.jsx';
import HomePage from './pages/HomePage.jsx';
import LoginPage from './pages/LoginPage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import FlatsPage from './pages/admin/FlatsPage.jsx';
import TenantsPage from './pages/admin/TenantsPage.jsx';
import RentPage from './pages/admin/RentPage.jsx';
import VisitorsPage from './pages/admin/VisitorsPage.jsx';
import DocumentsPage from './pages/admin/DocumentsPage.jsx';
import ComplaintsPage from './pages/ComplaintsPage.jsx';

// Pages for each role are added as their backlog items are built.
// Page access mirrors the API's role rules (FR-14).
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<RequireAuth roles={['admin']} />}>
          <Route path="/admin/flats" element={<FlatsPage />} />
          <Route path="/admin/tenants" element={<TenantsPage />} />
          <Route path="/admin/rent" element={<RentPage />} />
          <Route path="/admin/visitors" element={<VisitorsPage />} />
          <Route path="/admin/documents" element={<DocumentsPage />} />
        </Route>

        <Route element={<RequireAuth roles={['resident', 'admin', 'maintenance']} />}>
          <Route path="/complaints" element={<ComplaintsPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
