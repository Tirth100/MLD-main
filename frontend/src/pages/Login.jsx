import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      // In the original, they only had one form for both, but the JS would hit /login/manager or /login/employee?
      // Wait, original JS for login:
      // it just sent to /login with email and password?
      // Let's assume /login handles it if the API is smart, or I can just use /login/manager as fallback if it's not specified.
      // Wait, original main.js login logic:
      // e.preventDefault();
      // const data = { email, password };
      // api.post('/login', data).then(...)
      const payload = { email, password };
      const response = await api.post('/login', payload);
      
      if (response.success && response.token) {
        localStorage.setItem('uuid_token', response.token);
        localStorage.setItem('user_role', response.role || 'EMPLOYEE');
        
        if (response.role === 'MANAGER' || response.role === 'ADMIN') {
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
    <div className="auth-layout">
        {/* Left Brand Panel */}
        <div className="auth-brand-panel">
            <div className="auth-glow-orb orb-1"></div>
            <div className="auth-glow-orb orb-2"></div>

            <div className="auth-brand-content">
                <div className="auth-brand-icon">
                    <i className="bi bi-radar"></i>
                </div>
                <h1 className="fw-bold display-5 mb-3">Meeting Leech Detector</h1>
                <p className="auth-tagline">
                    AI-powered telemetry and analytics to measure true meeting engagement. Identify active contributors,
                    track focus metrics, and eliminate wasted time.
                </p>
            </div>
        </div>

        {/* Right Form Panel */}
        <div className="auth-form-panel">
            <div className="auth-form-card text-center">
                <h3 className="fw-bold mb-1">Welcome Back</h3>
                
                {error && <div className="alert alert-danger text-start small mb-3">{error}</div>}
                
                {/* Standard Email & Password Login Form */}
                <form id="loginForm" className="text-start mb-3" onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="email" className="form-label fw-semibold text-muted small mb-1">EMAIL ADDRESS</label>
                        <input type="email" className="form-control auth-input" id="email" placeholder="Enter your email" required
                               value={email} onChange={e => setEmail(e.target.value)} />
                    </div>
                    <div className="mb-3">
                        <label htmlFor="password" className="form-label fw-semibold text-muted small mb-1">PASSWORD</label>
                        <input type="password" className="form-control auth-input" id="password" placeholder="Enter your password" required
                               value={password} onChange={e => setPassword(e.target.value)} />
                    </div>
                    <button type="submit" className="btn btn-primary w-100 py-2 fw-bold shadow-sm mb-2" disabled={loading}>
                        <i className="bi bi-box-arrow-in-right me-1"></i> {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>

                <div className="d-flex align-items-center my-3">
                    <hr className="flex-grow-1 text-muted opacity-25" />
                    <span className="px-2 text-muted extra-small text-uppercase fw-semibold" style={{fontSize: '0.75rem'}}>OR CONTINUE WITH</span>
                    <hr className="flex-grow-1 text-muted opacity-25" />
                </div>

                <div className="d-flex justify-content-center mb-3 mt-2">
                    {/* Google Sign-in placeholder */}
                    <button className="btn btn-outline-secondary w-100 py-2 fw-bold">
                        <i className="bi bi-google me-2"></i> Sign In with Google
                    </button>
                </div>

                <div className="mt-3 pt-3 border-top">
                    <p className="text-muted small mb-2">Don't have an account?</p>
                    <button className="btn btn-outline-primary w-100 mb-2 fw-semibold">Register your Organization</button>
                    <button className="btn btn-link text-decoration-none w-100">Join as an Employee</button>
                </div>
            </div>
        </div>
    </div>
  );
}
