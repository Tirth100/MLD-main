import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { AlertTriangle, Users, Activity, Video, LogOut, Play, Square } from 'lucide-react';

export default function ManagerDashboard() {
  const [data, setData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [session, setSession] = useState({ active: false, code: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('uuid_token');
    localStorage.removeItem('user_role');
    navigate('/');
  };

  const fetchData = async () => {
    try {
      // 1. Fetch Session
      const sessionRes = await api.get('/active-session');
      if (sessionRes && sessionRes.active) {
        setSession({ active: true, code: sessionRes.sessionCode });
      } else {
        setSession({ active: false, code: '' });
      }

      // 2. Fetch Engagement
      const engRes = await api.get('/engagement');
      if (engRes && engRes.success === false && engRes.status === 401) {
        handleLogout();
        return;
      }
      if (Array.isArray(engRes)) {
        setData(engRes.reverse());
        setError(null);
      }

      // 3. Fetch Alerts
      const alertsRes = await api.get('/alerts');
      if (Array.isArray(alertsRes)) {
        setAlerts(alertsRes);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.message !== 'Failed to fetch') {
        console.error("Dashboard error:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('uuid_token');
    const role = localStorage.getItem('user_role');
    if (!token || (role !== 'MANAGER' && role !== 'ADMIN')) {
      navigate('/');
      return;
    }

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleStartSession = async () => {
    try {
      const response = await api.post('/start');
      if (response.success) {
        setSession({ active: true, code: response.sessionCode });
      } else {
        alert("Failed to start session: " + response.message);
      }
    } catch (e) {
      alert("Error starting backend session.");
    }
  };

  const handleStopSession = async () => {
    if (confirm("Are you sure you want to end the current monitoring session for all participants?")) {
      try {
        await api.get('/stop');
        setSession({ active: false, code: '' });
        fetchData();
      } catch (e) {
        alert("Error communicating with backend server.");
      }
    }
  };

  // Calculations
  const uniqueEmployees = new Set(data.map(emp => emp.name)).size;
  const avgEngagement = data.length > 0 
    ? Math.round(data.reduce((sum, emp) => sum + (emp.attentionScore * 100), 0) / data.length) 
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      {/* Sidebar */}
      <div className="w-full md:w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
        <div className="p-6 border-b border-gray-100 flex items-center gap-3 text-blue-600 font-bold text-xl">
          <Activity size={24} />
          MLD Admin
        </div>
        <div className="flex-1 py-6 px-4 space-y-2">
          <button className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg font-medium">
            <Activity size={20} /> Dashboard
          </button>
        </div>
        <div className="p-4 border-t border-gray-100">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-8 overflow-y-auto">
        {/* Header bar */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-8 flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-800">Overview</h1>
          <div>
            {!session.active ? (
              <button 
                onClick={handleStartSession}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
              >
                <Play size={18} fill="currentColor" /> Start Meeting Session
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="px-4 py-2 bg-green-50 border border-green-200 text-green-700 rounded-lg font-medium">
                  Session Code: <span className="font-bold">{session.code}</span>
                </div>
                <button 
                  onClick={handleStopSession}
                  className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors shadow-sm"
                >
                  <Square size={18} fill="currentColor" /> Stop Session
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-500 font-medium">Total Monitored</h3>
              <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Users size={20} /></div>
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-1">{uniqueEmployees}</div>
            <div className="text-sm text-green-600">↑ Based on active session</div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-500 font-medium">Avg Engagement</h3>
              <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Activity size={20} /></div>
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-1">{avgEngagement}%</div>
            <div className="text-sm text-green-600">↑ Across all records</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-500 font-medium">Active Meetings</h3>
              <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><Video size={20} /></div>
            </div>
            <div className="text-4xl font-bold text-gray-900 mb-1">{session.active ? 1 : 0}</div>
            <div className="text-sm text-gray-500">Live right now</div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-gray-500 font-medium">Low Engagement</h3>
              <div className="p-2 bg-red-50 text-red-600 rounded-lg"><AlertTriangle size={20} /></div>
            </div>
            <div className="text-4xl font-bold text-red-600 mb-1">{alerts.length}</div>
            <div className="text-sm text-red-500">Requires attention</div>
          </div>
        </div>

        {/* Table & Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-800">Live Employee Engagement</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-50 border-b border-gray-100 text-sm text-gray-600 font-medium">
                  <tr>
                    <th className="px-6 py-4">Employee</th>
                    <th className="px-6 py-4">Active Window</th>
                    <th className="px-6 py-4">Webcam</th>
                    <th className="px-6 py-4">Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="px-6 py-8 text-center text-gray-500">
                        {session.active ? "Waiting for employee data..." : "No active session."}
                      </td>
                    </tr>
                  ) : (
                    data.map((emp, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
                              {emp.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-gray-900">{emp.name}</div>
                              <div className="text-xs text-blue-600">Live Session</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-600 max-w-[200px] truncate" title={emp.window}>
                            {emp.window}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {emp.webcam ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                              <Video size={12} /> ON
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200">
                              OFF
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <span className={`text-sm font-bold ${emp.attentionScore < 0.5 ? 'text-red-600' : 'text-gray-900'}`}>
                              {Math.round(emp.attentionScore * 100)}%
                            </span>
                            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden w-16">
                              <div 
                                className={`h-full rounded-full ${emp.attentionScore < 0.5 ? 'bg-red-500' : 'bg-blue-500'}`} 
                                style={{ width: `${emp.attentionScore * 100}%` }}
                              ></div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-800">Recent Alerts</h2>
            </div>
            <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-50 text-gray-400 mb-3">
                    <Activity size={24} />
                  </div>
                  <p>No alerts at this time.</p>
                </div>
              ) : (
                alerts.map((alert, i) => (
                  <div key={i} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 text-red-500"><AlertTriangle size={18} /></div>
                      <div>
                        <div className="font-medium text-gray-900 text-sm">Low Engagement: {alert.name}</div>
                        <div className="text-xs text-gray-500 mt-1">Score dropped to {Math.round(alert.attentionScore * 100)}%</div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
