import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

const GOOGLE_CLIENT_ID = '117803210601-81apks2hhlv1p4og1g5knp85375r69em.apps.googleusercontent.com';

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

  const handleGoogleCallback = async (googleResponse) => {
    if (!googleResponse || !googleResponse.credential) {
      setError('Google sign-in could not be completed.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/google-login', { token: googleResponse.credential });
      if (res && res.success && res.token) {
        localStorage.setItem('uuid_token', res.token);
        localStorage.setItem('user_role', res.role || 'EMPLOYEE');
        if (res.name) {
          localStorage.setItem('username', res.name);
        }
        
        if (res.role === 'MANAGER' || res.role === 'ADMIN') {
          navigate('/manager-dashboard');
        } else {
          navigate('/employee-dashboard');
        }
      } else {
        setError(res.message || 'No registered account found for this Google email. Please register your workspace or join as a participant first.');
      }
    } catch (err) {
      setError('Failed to sign in with Google. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initGoogle = () => {
      if (window.google?.accounts?.id) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleGoogleCallback,
          auto_select: false
        });
        const btnContainer = document.getElementById('googleSignInBtn');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'signin_with',
            shape: 'rectangular'
          });
        }
      }
    };

    initGoogle();
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        initGoogle();
        clearInterval(timer);
      }
    }, 400);

    return () => clearInterval(timer);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = { email, password };
      const response = await api.post('/login', payload);
      
      if (response.success && response.token) {
        localStorage.setItem('uuid_token', response.token);
        localStorage.setItem('user_role', response.role || 'EMPLOYEE');
        if (response.name) {
          localStorage.setItem('username', response.name);
        }
        
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

                <div className="d-flex justify-content-center mb-3 mt-2" style={{ minHeight: '44px' }}>
                    <div id="googleSignInBtn" className="w-100 d-flex justify-content-center"></div>
                </div>

                <div className="mt-3 pt-3 border-top">
                    <p className="text-muted small mb-2">Don't have an account?</p>
                    <Link to="/organization-signup" className="btn btn-outline-primary w-100 mb-2 fw-semibold">Register your Workspace</Link>
                    <Link to="/employee-signup" className="btn btn-link text-decoration-none w-100">Join as a Participant</Link>
                </div>
            </div>
        </div>
    </div>
  );
}
