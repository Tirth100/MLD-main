import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
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
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/index.html" element={<Login />} />
        
        <Route path="/organization-signup" element={<OrganizationSignup />} />
        <Route path="/pages/organization-signup.html" element={<OrganizationSignup />} />
        
        <Route path="/employee-signup" element={<EmployeeSignup />} />
        <Route path="/pages/employee-signup.html" element={<EmployeeSignup />} />
        
        <Route path="/manager-dashboard" element={<ManagerDashboard />} />
        <Route path="/pages/manager-dashboard.html" element={<ManagerDashboard />} />
        
        <Route path="/employee-dashboard" element={<EmployeeDashboard />} />
        <Route path="/pages/employee-dashboard.html" element={<EmployeeDashboard />} />
        
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/pages/analytics.html" element={<Analytics />} />
        
        <Route path="/alerts" element={<Alerts />} />
        <Route path="/pages/alerts.html" element={<Alerts />} />
        
        <Route path="/reports" element={<Reports />} />
        <Route path="/pages/reports.html" element={<Reports />} />
        
        <Route path="/agent-setup" element={<AgentSetup />} />
        <Route path="/pages/agent-setup.html" element={<AgentSetup />} />
        <Route path="/agent-setup.html" element={<AgentSetup />} />
        <Route path="/pages/agent-setup" element={<AgentSetup />} />
        
        <Route path="/mobile-agent" element={<MobileAgent />} />
        <Route path="/pages/mobile-agent.html" element={<MobileAgent />} />
        
        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
