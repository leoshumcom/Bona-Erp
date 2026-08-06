import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import LoginPage from './pages/login/index';
import FactoryDashboard from './pages/factory/FactoryDashboard';
import WarehouseDashboard from './pages/warehouse/WarehouseDashboard';
import OperationDashboard from './pages/operation/OperationDashboard';
import AftersalesDashboard from './pages/aftersales/AftersalesDashboard';
import BossDashboard from './pages/boss/BossDashboard';
import { useAppStore } from './stores/appStore';

const roleDefaultPath: Record<string, string> = {
  BOSS: '/boss',
  ADMIN: '/boss',
  FACTORY_MANAGER: '/factory',
  WAREHOUSE_MANAGER: '/warehouse',
  OPERATOR: '/operation',
  AFTERSALES_SPECIALIST: '/aftersales',
};

function RootRedirect() {
  const user = useAppStore((s) => s.user);
  const target = user ? roleDefaultPath[user.role] || '/boss' : '/login';
  return <Navigate to={target} replace />;
}

function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAppStore((s) => s.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <AuthGuard>
            <MainLayout />
          </AuthGuard>
        }
      >
        <Route index element={<RootRedirect />} />
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
