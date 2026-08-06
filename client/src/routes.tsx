import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/login/LoginPage';
import FactoryDashboard from './pages/factory/FactoryDashboard';
import WarehouseDashboard from './pages/warehouse/WarehouseDashboard';
import OperationDashboard from './pages/operation/OperationDashboard';
import AftersalesDashboard from './pages/aftersales/AftersalesDashboard';
import BossDashboard from './pages/boss/BossDashboard';

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<MainLayout />}>
        <Route index element={<Navigate to="/boss" replace />} />
        <Route path="boss" element={<BossDashboard />} />
        <Route path="factory" element={<FactoryDashboard />} />
        <Route path="warehouse" element={<WarehouseDashboard />} />
        <Route path="operation" element={<OperationDashboard />} />
        <Route path="aftersales" element={<AftersalesDashboard />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default AppRoutes;
