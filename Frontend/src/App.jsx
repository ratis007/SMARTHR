import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';
import { AuthProvider } from './contexts/AuthContext';

// Layouts
import MainLayout from './layouts/MainLayout';
import CompanyLayout from './layouts/CompanyLayout';

// Pages globales
import LoginPage from './pages/LoginPage';
import HomePage from './pages/HomePage';
import Dashboard from './pages/Dashboard';
import EmployeesPage from './pages/EmployeesPage';
import EmployeeDetail from './pages/EmployeeDetail';
import CompaniesPage from './pages/CompaniesPage';
import PayrollPage from './pages/PayrollPage';
import LeavePage from './pages/LeavePage';
import ContractsPage from './pages/ContractsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';

// Pages scoped (espace entreprise)
import CompanyDashboard from './pages/company/CompanyDashboard';
import CompanyEmployees from './pages/company/CompanyEmployees';
import CompanyContracts from './pages/company/CompanyContracts';
import CompanyPayroll from './pages/company/CompanyPayroll';
import CompanyLeave from './pages/company/CompanyLeave';
import CompanyReports from './pages/company/CompanyReports';
import CompanySettings from './pages/company/CompanySettings';

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Page d'accueil — sans sidebar */}
      <Route path="/" element={<PrivateRoute><HomePage /></PrivateRoute>} />

      {/* Espace global avec sidebar (companies, settings, etc.) */}
      <Route path="/admin" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="employees/:id" element={<EmployeeDetail />} />
        <Route path="contracts" element={<ContractsPage />} />
        <Route path="payroll" element={<PayrollPage />} />
        <Route path="leave" element={<LeavePage />} />
        <Route path="reports" element={<ReportsPage />} />
      </Route>

      {/* Routes directes depuis la HomePage */}
      <Route path="/companies" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route index element={<CompaniesPage />} />
      </Route>
      <Route path="/settings" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
        <Route index element={<SettingsPage />} />
      </Route>

      {/* Espace entreprise — toutes les données sont scoped par :companyId */}
      <Route path="/app/:companyId" element={<PrivateRoute><CompanyLayout /></PrivateRoute>}>
        <Route index element={<Navigate to="dashboard" replace />} />
        <Route path="dashboard" element={<CompanyDashboard />} />
        <Route path="employees" element={<CompanyEmployees />} />
        <Route path="contracts" element={<CompanyContracts />} />
        <Route path="payroll" element={<CompanyPayroll />} />
        <Route path="leave" element={<CompanyLeave />} />
        <Route path="reports" element={<CompanyReports />} />
        <Route path="settings" element={<CompanySettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
