import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const [activeTab, setActiveTab] = useState('manager');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [orgCode, setOrgCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // If already logged in, redirect
    const token = localStorage.getItem('uuid_token');
    const role = localStorage.getItem('user_role');
    if (token) {
      if (role === 'MANAGER' || role === 'ADMIN') {
        navigate('/manager-dashboard');
      } else {
        navigate('/employee-dashboard');
      }
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const endpoint = activeTab === 'manager' ? '/login/manager' : '/login/employee';
      const payload = { email, password };
      if (activeTab === 'manager') payload.orgCode = orgCode;

      const response = await api.post(endpoint, payload);
      
      if (response.success && response.token) {
        localStorage.setItem('uuid_token', response.token);
        localStorage.setItem('user_role', response.role || (activeTab === 'manager' ? 'MANAGER' : 'EMPLOYEE'));
        
        if (activeTab === 'manager' || response.role === 'MANAGER' || response.role === 'ADMIN') {
          navigate('/manager-dashboard');
        } else {
          navigate('/employee-dashboard');
        }
      } else {
        setError(response.message || 'Login failed. Check your credentials.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-blue-600 p-8 text-center text-white">
          <h1 className="text-3xl font-bold mb-2">MLD System</h1>
          <p className="text-blue-100">Meeting & Log Dashboard</p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="flex bg-gray-100 rounded-lg p-1 mb-8">
            <button 
              className={`flex-1 py-2 rounded-md font-medium transition-all ${activeTab === 'manager' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setActiveTab('manager'); setError(''); }}
            >
              Manager
            </button>
            <button 
              className={`flex-1 py-2 rounded-md font-medium transition-all ${activeTab === 'employee' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => { setActiveTab('employee'); setError(''); }}
            >
              Employee
            </button>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                required 
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
            </div>

            {activeTab === 'manager' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Organization Code (Optional)</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  value={orgCode}
                  onChange={e => setOrgCode(e.target.value)}
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors disabled:opacity-70 disabled:cursor-not-allowed mt-2"
            >
              {loading ? 'Authenticating...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
