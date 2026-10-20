import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import HomePage from './pages/HomePage.jsx';
import NotFoundPage from './pages/NotFoundPage.jsx';
import FlatsPage from './pages/admin/FlatsPage.jsx';
import VisitorsPage from './pages/admin/VisitorsPage.jsx';
import ComplaintsPage from './pages/ComplaintsPage.jsx';

// Pages for each role are added as their backlog items are built.
export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/admin/flats" element={<FlatsPage />} />
        <Route path="/admin/visitors" element={<VisitorsPage />} />
        <Route path="/complaints" element={<ComplaintsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}