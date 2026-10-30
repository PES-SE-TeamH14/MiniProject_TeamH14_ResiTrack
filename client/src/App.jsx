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
import MaintenanceBoardPage from './pages/admin/MaintenanceBoardPage.jsx';
import ComplaintsPage from './pages/ComplaintsPage.jsx';
import MyReceiptsPage from './pages/MyReceiptsPage.jsx';
import MaintenanceRequestsPage from './pages/MaintenanceRequestsPage.jsx';
import NoticesPage from './pages/NoticesPage.jsx';
import FinancialSummaryPage from './pages/owner/FinancialSummaryPage.jsx';

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
          <Route path="/admin/maintenance" element={<MaintenanceBoardPage />} />
        </Route>

        <Route element={<RequireAuth roles={['resident']} />}>
          <Route path="/receipts" element={<MyReceiptsPage />} />
        </Route>

        <Route element={<RequireAuth roles={['resident', 'maintenance']} />}>
          <Route path="/maintenance-requests" element={<MaintenanceRequestsPage />} />
        </Route>

        <Route element={<RequireAuth roles={['resident', 'admin', 'maintenance']} />}>
          <Route path="/complaints" element={<ComplaintsPage />} />
        </Route>

        <Route element={<RequireAuth roles={['resident', 'admin', 'maintenance', 'owner']} />}>
          <Route path="/notices" element={<NoticesPage />} />
        </Route>

        <Route element={<RequireAuth roles={['owner', 'admin']} />}>
          <Route path="/owner/summary" element={<FinancialSummaryPage />} />
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
