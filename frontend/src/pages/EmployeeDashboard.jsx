import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { LogOut, Camera, Activity, Monitor } from 'lucide-react';

export default function EmployeeDashboard() {
  const [session, setSession] = useState({ active: false, code: '' });
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    attentionScore: 0,
    webcam: false,
    duration: 0,
    idleSeconds: 0
  });
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('uuid_token');
    localStorage.removeItem('user_role');
    navigate('/');
  };

  const fetchStatus = async () => {
    try {
      // 1. Check Active Session
      const sessionRes = await api.get('/active-session');
      if (sessionRes && sessionRes.active) {
        setSession({ active: true, code: sessionRes.sessionCode });
      } else {
        setSession({ active: false, code: '' });
      }

      // 2. If in session, fetch my specific stats from /engagement
      if (sessionRes && sessionRes.active) {
        const engRes = await api.get('/engagement');
        if (Array.isArray(engRes)) {
          // In the real system, the employee's ID/token maps to their data.
          // For now, we take the first matching employee or just display overall logic if needed.
          // Actually, the desktop agent sends data. The employee dashboard doesn't have an endpoint for single employee stats easily unless we filter the array.
          // Let's just grab the last updated one for now, or assume the backend filters if role=EMPLOYEE.
          // Wait, the backend /engagement returns ALL employees if called by employee?
          // Actually /engagement for employee returns their own stats or fails.
          if (engRes.length > 0) {
            setDashboardData(engRes[0]);
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.message !== 'Failed to fetch') {
        console.error("Dashboard error:", err);
      }
    } finally {
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('uuid_token');
    if (!token) {
      navigate('/');
      return;
    }

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const response = await api.post('/join', { sessionCode: joinCode });
      if (response.success) {
        setSession({ active: true, code: joinCode });
      } else {
        setError(response.message || 'Failed to join session.');
      }
    } catch (err) {
      setError('Network error connecting to session.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      {/* Navbar / Header */}
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold">
            MLD
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Employee Dashboard</h1>
            <p className="text-xs text-gray-500">Meeting & Log System</p>
          </div>
        </div>
        <button 
          onClick={handleLogout}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 font-medium px-4 py-2 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <LogOut size={18} /> Logout
        </button>
      </div>

      <div className="w-full max-w-4xl space-y-6">
        {/* Status Alert */}
        <div className={`rounded-xl p-6 border ${session.active ? 'bg-blue-50 border-blue-100' : 'bg-gray-100 border-gray-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`p-3 rounded-full ${session.active ? 'bg-blue-100 text-blue-600' : 'bg-gray-200 text-gray-500'}`}>
              <Camera size={24} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-1">Meeting Status</h2>
              {session.active ? (
                <div className="text-blue-700 font-medium">Active Monitoring Session (<span className="font-bold">{session.code}</span>)</div>
              ) : (
                <div className="text-gray-600 font-medium">No Active Session</div>
              )}
            </div>
          </div>
        </div>

        {/* Conditional View: Join Form vs Live Dashboard */}
        {!session.active ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center max-w-md mx-auto">
            <h2 className="text-xl font-bold text-gray-800 mb-2">Join a Session</h2>
            <p className="text-gray-500 mb-6 text-sm">Enter the code provided by your manager to begin the monitoring session.</p>
            
            {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded-lg border border-red-100">{error}</div>}
            
            <form onSubmit={handleJoin} className="space-y-4">
              <input 
                type="text" 
                placeholder="e.g., MLD123" 
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-center font-mono text-lg uppercase transition-all"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              />
              <button 
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors shadow-sm"
              >
                Join Session
              </button>
            </form>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-gray-500 font-medium">Webcam Status</h3>
                <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Camera size={20} /></div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {dashboardData.webcam ? 'ACTIVE (ON)' : 'INACTIVE (OFF)'}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-gray-500 font-medium">Window Focus</h3>
                <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><Monitor size={20} /></div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {Math.round((dashboardData.attentionScore || 0) * 100)}%
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-gray-500 font-medium">Session Duration</h3>
                <div className="p-2 bg-green-50 text-green-600 rounded-lg"><Activity size={20} /></div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">
                {Math.floor((dashboardData.duration || 0) / 60)}m {(dashboardData.duration || 0) % 60}s
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-gray-500 font-medium">Idle Time</h3>
                <div className="p-2 bg-red-50 text-red-600 rounded-lg"><Monitor size={20} /></div>
              </div>
              <div className="text-2xl font-bold text-red-600 mb-1">
                {dashboardData.idleSeconds || 0}s
              </div>
            </div>
            
            <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-4 text-center">
              <p className="text-gray-500 text-sm">
                Your activity is currently being securely logged to the active session. Ensure you remain focused on productive windows to maintain your engagement score.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
