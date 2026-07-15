import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Suppliers from './pages/Suppliers';
import Purchases from './pages/Purchases';
import Cheques from './pages/Cheques';
import Revenue from './pages/Revenue';
import Reports from './pages/Reports';
import SmsLog from './pages/SmsLog';
import ActivityLog from './pages/ActivityLog';
import Settings from './pages/Settings';

function Protected({ children }) {
  const { isAuthed } = useAuth();
  return isAuthed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Layout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="suppliers" element={<Suppliers />} />
        <Route path="purchases" element={<Purchases />} />
        <Route path="cheques" element={<Cheques />} />
        <Route path="revenue" element={<Revenue />} />
        <Route path="reports" element={<Reports />} />
        <Route path="sms-log" element={<SmsLog />} />
        <Route path="activity" element={<ActivityLog />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
