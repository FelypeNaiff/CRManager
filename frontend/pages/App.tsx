import { Link, Route, Routes } from 'react-router-dom';
import { MainLayout } from '../layouts/MainLayout';
import { DashboardPage } from './DashboardPage';
import { CRMPage } from './CRMPage';
import { PortalPage } from './PortalPage';

export const App = () => {
  return (
    <MainLayout>
      <nav className="flex gap-3 mb-5">
        <Link to="/" className="underline">Dashboard</Link>
        <Link to="/crm" className="underline">CRM</Link>
        <Link to="/portal" className="underline">Portal Cliente</Link>
      </nav>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/crm" element={<CRMPage />} />
        <Route path="/portal" element={<PortalPage />} />
      </Routes>
    </MainLayout>
  );
};
