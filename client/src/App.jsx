import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import RequireAuth from './components/RequireAuth';
import Layout from './components/Layout';
import Login from './pages/Login';
import VerifyAccount from './pages/VerifyAccount';
import Console from './pages/Console';
import Tasks from './pages/Tasks';
import Leave from './pages/Leave';
import Employees from './pages/Employees';
import KananHRM from './pages/KananHRM';
import Attendance from './pages/Attendance';
import Organization from './pages/Organization';
import Profile from './pages/Profile';
import HRAdmin from './pages/HRAdmin';
import HRSettings from './pages/HRSettings';
import RecruitDashboard from './pages/RecruitDashboard';
import RecruitRequisitions from './pages/RecruitRequisitions';
import RecruitInterviews from './pages/RecruitInterviews';
import RecruitOffers from './pages/RecruitOffers';
import TechAdmin from './pages/TechAdmin';
import ModuleConfig from './pages/ModuleConfig';
import TechEmployeeEdit from './pages/TechEmployeeEdit';
import EmployeeProfileAdmin from './pages/EmployeeProfileAdmin';
import LegacyPage from './legacy/LegacyPage';

const LEGACY_ROUTES = [
  'ess', 'payroll', 'policies', 'schedule',
  'news', 'crm', 'coaching', 'kapply', 'vas', 'events', 'kb', 'mom', 'reports',
  'training', 'culture', 'leaderboard', 'kpoints', 'badges',
  'helpdesk', 'assets', 'rooms', 'requests'
];

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/verify/:token" element={<VerifyAccount />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/console" element={<Console />} />
          <Route path="/tasks" element={<Tasks />} />
          <Route path="/leave" element={<Leave />} />
          <Route path="/employees" element={<Employees />} />
          <Route path="/home" element={<KananHRM />} />
          <Route path="/attendance" element={<Attendance />} />
          <Route path="/organization" element={<Organization />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/hr-admin" element={<HRAdmin />} />
          <Route path="/hr-settings" element={<HRSettings />} />
          <Route path="/recruitment" element={<RecruitDashboard />} />
          <Route path="/recruitment/requisitions" element={<RecruitRequisitions />} />
          <Route path="/recruitment/interviews" element={<RecruitInterviews />} />
          <Route path="/recruitment/offers" element={<RecruitOffers />} />
          <Route path="/tech-admin" element={<TechAdmin />} />
          <Route path="/module-config" element={<ModuleConfig />} />
          <Route path="/module-config/employee/:id" element={<TechEmployeeEdit />} />
          <Route path="/hr-admin/employee/:id" element={<EmployeeProfileAdmin />} />
          {LEGACY_ROUTES.map((id) => (
            <Route key={id} path={`/${id}`} element={<LegacyPage id={id} />} />
          ))}
        </Route>
      </Routes>
    </AuthProvider>
  );
}
