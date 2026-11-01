import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

const GOOGLE_CLIENT_ID = '117803210601-81apks2hhlv1p4og1g5knp85375r69em.apps.googleusercontent.com';

export default function EmployeeSignup() {
  const [orgCode, setOrgCode] = useState('');
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const orgCodeRef = useRef(orgCode);
  orgCodeRef.current = orgCode;

  const navigate = useNavigate();

  const handleGoogleCallback = async (googleResponse) => {
    if (!googleResponse || !googleResponse.credential) {
      setError('Google verification failed.');
      return;
    }
    const currentCode = orgCodeRef.current ? orgCodeRef.current.trim() : '';
    if (!currentCode) {
      setError('Please enter your Organization Code in the field above before joining with Google.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      const res = await api.post('/google-signup-emp', {
        token: googleResponse.credential,
        orgCode: currentCode
      });
      if (res && res.success && res.token) {
        localStorage.setItem('uuid_token', res.token);
        localStorage.setItem('user_role', 'EMPLOYEE');
        if (res.name) localStorage.setItem('username', res.name);
        navigate('/employee-dashboard');
      } else {
        setError(res.message || 'Failed to join organization with Google. Please check your Organization Code.');
      }
    } catch (err) {
      setError('Failed to join organization with Google. Please try again.');
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
        const btnContainer = document.getElementById('googleEmpJoinBtn');
        if (btnContainer) {
          btnContainer.innerHTML = '';
          window.google.accounts.id.renderButton(btnContainer, {
            theme: 'outline',
            size: 'large',
            width: '100%',
            text: 'signup_with',
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
      const payload = {
        orgCode: orgCode,
        name: empName,
        email: empEmail,
        password: empPassword
      };
      
      const response = await api.post('/signup-emp', payload);
      if (response.success) {
        navigate('/');
      } else {
        setError(response.message || 'Failed to join organization.');
      }
    } catch (err) {
      setError('A network error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-layout">
        <div className="auth-brand-panel">
            <div className="auth-glow-orb orb-1" style={{background: 'var(--secondary)'}}></div>
            <div className="auth-glow-orb orb-2" style={{background: 'var(--primary)'}}></div>

            <div className="auth-brand-content">
                <div className="auth-brand-icon">
                    <i className="bi bi-people-fill text-secondary"></i>
                </div>
                <h1 className="fw-bold display-5 mb-3">Join Your Team</h1>
                <p className="auth-tagline">
                    Connect your MLD agent to your organization's workspace. Your engagement, focus, and participation
                    metrics will be automatically securely synced.
                </p>
            </div>
        </div>

        <div className="auth-form-panel">
            <div className="auth-form-card text-center">
                <h3 className="fw-bold mb-1">Employee Signup</h3>
                <p className="text-muted mb-4">Join your organization's workspace</p>
                
                {error && <div className="alert alert-danger text-start small mb-3">{error}</div>}

                <form className="text-start" onSubmit={handleSubmit}>
                    <div className="mb-3">
                        <label htmlFor="orgCodeInput" className="form-label fw-semibold text-muted small mb-1">ORGANIZATION CODE</label>
                        <input type="text" className="form-control auth-input fw-bold text-center text-primary"
                            id="orgCodeInput" placeholder="Enter Org Code" style={{letterSpacing: '2px', fontSize: '1.1rem'}}
                            required
                            value={orgCode} onChange={e => setOrgCode(e.target.value)} />
                        <div className="form-text mt-1"><i className="bi bi-info-circle me-1"></i> Ask your manager for the Org Code.</div>
                    </div>

                    <div className="mb-3">
                        <label htmlFor="empName" className="form-label fw-semibold text-muted small mb-1">FULL NAME</label>
                        <input type="text" className="form-control auth-input" id="empName" placeholder="Enter full name" required
                               value={empName} onChange={e => setEmpName(e.target.value)} />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="empEmail" className="form-label fw-semibold text-muted small mb-1">WORK EMAIL</label>
                        <input type="email" className="form-control auth-input" id="empEmail" placeholder="Enter work email" required
                               value={empEmail} onChange={e => setEmpEmail(e.target.value)} />
                    </div>

                    <div className="mb-3">
                        <label htmlFor="empPassword" className="form-label fw-semibold text-muted small mb-1">PASSWORD</label>
                        <input type="password" className="form-control auth-input" id="empPassword" placeholder="Enter password" required
                               value={empPassword} onChange={e => setEmpPassword(e.target.value)} />
                    </div>

                    <button type="submit" className="btn btn-primary w-100 py-2 fw-bold shadow-sm mb-3" disabled={loading}>
                        <i className="bi bi-person-plus me-1"></i> {loading ? 'Joining...' : 'Join Organization'}
                    </button>
                </form>

                <div className="d-flex align-items-center my-3">
                    <hr className="flex-grow-1 text-muted opacity-25" />
                    <span className="px-2 text-muted extra-small text-uppercase fw-semibold" style={{fontSize: '0.75rem'}}>OR JOIN WITH GOOGLE</span>
                    <hr className="flex-grow-1 text-muted opacity-25" />
                </div>

                <div className="d-flex justify-content-center mb-3 mt-2" style={{ minHeight: '44px' }}>
                    <div id="googleEmpJoinBtn" className="w-100 d-flex justify-content-center"></div>
                </div>

                <div className="mt-4 pt-3 border-top">
                    <Link to="/" className="btn btn-link text-decoration-none w-100 text-muted">
                        <i className="bi bi-arrow-left me-1"></i> Back to Login
                    </Link>
                </div>
            </div>
        </div>
    </div>
  );
}
