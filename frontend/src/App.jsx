import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import ManagerDashboard from './pages/ManagerDashboard';
import EmployeeDashboard from './pages/EmployeeDashboard';

import OrganizationSignup from './pages/OrganizationSignup';
import EmployeeSignup from './pages/EmployeeSignup';
import Analytics from './pages/Analytics';
import Alerts from './pages/Alerts';
import Reports from './pages/Reports';
import AgentSetup from './pages/AgentSetup';
import MobileAgent from './pages/MobileAgent';

function App() {
  useEffect(() => {
    // Automatically redirect legacy hash URLs (e.g., #/agent-setup) to standard paths (/agent-setup)
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      const cleanPath = window.location.hash.substring(1);
      window.location.replace(cleanPath);
    }
  }, []);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        
        <Route path="/organization-signup" element={<OrganizationSignup />} />
        <Route path="/employee-signup" element={<EmployeeSignup />} />
        <Route path="/manager-dashboard" element={<ManagerDashboard />} />
        <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/agent-setup" element={<AgentSetup />} />
        <Route path="/mobile-agent" element={<MobileAgent />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
