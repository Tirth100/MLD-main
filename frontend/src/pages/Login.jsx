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

  // Forgot Password Modal States
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotStep, setForgotStep] = useState(1); // 1 = request code, 2 = enter otp & new pass, 3 = success
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [devOtpHint, setDevOtpHint] = useState('');

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
        if (res.name) localStorage.setItem('username', res.name);
        if (res.orgName) localStorage.setItem('org_name', res.orgName);
        if (res.orgCode) localStorage.setItem('org_code', res.orgCode);
        
        if (res.role === 'MANAGER' || res.role === 'ADMIN') {
          navigate('/manager-dashboard');
        } else {
          navigate('/employee-dashboard');
        }
      } else {
        setError(res.message || "You haven't joined any workspace yet. Please register your workspace or join as a participant with your Workspace Code first.");
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
        if (response.name) localStorage.setItem('username', response.name);
        if (response.orgName) localStorage.setItem('org_name', response.orgName);
        if (response.orgCode) localStorage.setItem('org_code', response.orgCode);
        
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

  const openForgotPassword = () => {
    setForgotEmail(email || '');
    setForgotOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setForgotError('');
    setForgotSuccess('');
    setDevOtpHint('');
    setForgotStep(1);
    setShowForgotModal(true);
  };

  const handleRequestResetOtp = async (e) => {
    e.preventDefault();
    if (!forgotEmail || !forgotEmail.trim()) {
      setForgotError('Please enter your registered email address.');
      return;
    }
    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.post('/forgot-password', { email: forgotEmail.trim() });
      if (res && res.success) {
        setForgotStep(2);
        if (res.devOtp) {
          setDevOtpHint(res.devOtp);
        }
        setForgotSuccess(res.message || 'Verification code generated.');
      } else {
        setForgotError(res.message || 'Could not find an account with that email.');
      }
    } catch (err) {
      setForgotError('Failed to send verification code. Please check your network and try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    if (!forgotOtp || !forgotOtp.trim()) {
      setForgotError('Please enter the 6-digit verification code.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setForgotError('Password must contain at least one uppercase letter, one lowercase letter, and one number.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('New passwords do not match.');
      return;
    }

    setForgotError('');
    setForgotLoading(true);
    try {
      const res = await api.post('/reset-password', {
        email: forgotEmail.trim(),
        otp: forgotOtp.trim(),
        newPassword
      });
      if (res && res.success) {
        setForgotStep(3);
      } else {
        setForgotError(res.message || 'Password reset failed. Invalid or expired code.');
      }
    } catch (err) {
      setForgotError('Network error while resetting password. Please try again.');
    } finally {
      setForgotLoading(false);
    }
  };

  const finishAndSignIn = () => {
    setEmail(forgotEmail);
    setPassword('');
    setShowForgotModal(false);
  };

  return (
    <div className="auth-layout">
        {/* Left Brand Panel */}
        <div className="auth-brand-panel">
            <div className="auth-glow-orb orb-1"></div>
            <div className="auth-glow-orb orb-2"></div>

            <div className="auth-brand-content">
                <div className="auth-brand-icon mb-4">
                    <img src="/logo.png" alt="MLD" width="68" height="68" className="rounded-4 shadow" />
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
                        <div className="d-flex justify-content-between align-items-center mb-1">
                            <label htmlFor="password" className="form-label fw-semibold text-muted small mb-0">PASSWORD</label>
                            <button
                                type="button"
                                className="btn btn-link p-0 text-decoration-none small text-primary"
                                style={{ fontSize: '0.80rem' }}
                                onClick={openForgotPassword}
                            >
                                Forgot password?
                            </button>
                        </div>
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

        {/* Forgot Password Modal */}
        {showForgotModal && (
            <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.55)', zIndex: 1055 }}>
                <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: '440px' }}>
                    <div className="modal-content border-0 shadow-lg rounded-3">
                        <div className="modal-header border-bottom pb-2">
                            <h5 className="modal-title fw-bold fs-6 d-flex align-items-center">
                                <i className="bi bi-shield-lock text-primary me-2 fs-5"></i>
                                {forgotStep === 3 ? 'Password Reset Complete' : 'Reset Your Password'}
                            </h5>
                            <button type="button" className="btn-close" aria-label="Close" onClick={() => setShowForgotModal(false)}></button>
                        </div>
                        
                        <div className="modal-body p-4 text-start">
                            {forgotError && (
                                <div className="alert alert-danger py-2 px-3 small mb-3">
                                    <i className="bi bi-exclamation-triangle-fill me-1"></i> {forgotError}
                                </div>
                            )}
                            
                            {forgotStep === 1 && (
                                <form onSubmit={handleRequestResetOtp}>
                                    <p className="text-muted small mb-3">
                                        Enter your registered account email. We'll generate a 6-digit verification code to reset your password.
                                    </p>
                                    <div className="mb-3">
                                        <label className="form-label fw-semibold text-muted small mb-1">EMAIL ADDRESS</label>
                                        <input
                                            type="email"
                                            className="form-control auth-input"
                                            placeholder="Enter your registered email"
                                            required
                                            value={forgotEmail}
                                            onChange={e => setForgotEmail(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="btn btn-primary w-100 py-2 fw-semibold shadow-sm"
                                        disabled={forgotLoading}
                                    >
                                        {forgotLoading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Generating Code...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-send me-1"></i> Send Verification Code
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}

                            {forgotStep === 2 && (
                                <form onSubmit={handleResetPasswordSubmit}>
                                    <div className="d-flex justify-content-between align-items-center mb-2">
                                        <span className="small text-muted">
                                            Code sent for: <strong className="text-dark">{forgotEmail}</strong>
                                        </span>
                                        <button
                                            type="button"
                                            className="btn btn-link p-0 text-decoration-none"
                                            style={{ fontSize: '0.78rem' }}
                                            onClick={() => setForgotStep(1)}
                                        >
                                            Change Email
                                        </button>
                                    </div>

                                    {devOtpHint && (
                                        <div className="alert alert-info py-2 px-3 small d-flex justify-content-between align-items-center mb-3">
                                            <span>
                                                <i className="bi bi-info-circle me-1"></i> Verification Code: <strong>{devOtpHint}</strong>
                                            </span>
                                            <button
                                                type="button"
                                                className="btn btn-sm btn-outline-primary py-0 px-2"
                                                style={{ fontSize: '0.75rem' }}
                                                onClick={() => setForgotOtp(devOtpHint)}
                                            >
                                                Autofill
                                            </button>
                                        </div>
                                    )}

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold text-muted small mb-1">6-DIGIT VERIFICATION CODE</label>
                                        <input
                                            type="text"
                                            maxLength="6"
                                            className="form-control text-center fw-bold"
                                            style={{ letterSpacing: '4px', fontSize: '1.2rem' }}
                                            placeholder="••••••"
                                            required
                                            value={forgotOtp}
                                            onChange={e => setForgotOtp(e.target.value.replace(/\D/g, ''))}
                                            autoFocus
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold text-muted small mb-1">NEW PASSWORD</label>
                                        <input
                                            type="password"
                                            className="form-control auth-input"
                                            placeholder="At least 8 chars (1 upper, 1 lower, 1 digit)"
                                            required
                                            value={newPassword}
                                            onChange={e => setNewPassword(e.target.value)}
                                        />
                                    </div>

                                    <div className="mb-3">
                                        <label className="form-label fw-semibold text-muted small mb-1">CONFIRM NEW PASSWORD</label>
                                        <input
                                            type="password"
                                            className="form-control auth-input"
                                            placeholder="Re-enter new password"
                                            required
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn btn-primary w-100 py-2 fw-semibold shadow-sm mb-2"
                                        disabled={forgotLoading}
                                    >
                                        {forgotLoading ? (
                                            <>
                                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                                Updating Password...
                                            </>
                                        ) : (
                                            <>
                                                <i className="bi bi-key-fill me-1"></i> Reset Password
                                            </>
                                        )}
                                    </button>
                                </form>
                            )}

                            {forgotStep === 3 && (
                                <div className="text-center py-2">
                                    <div className="mb-3 text-success">
                                        <i className="bi bi-check-circle-fill" style={{ fontSize: '3rem' }}></i>
                                    </div>
                                    <h5 className="fw-bold mb-2">Password Reset Successful!</h5>
                                    <p className="text-muted small mb-4">
                                        Your account password has been securely updated. You can now log in with your new credentials.
                                    </p>
                                    <button
                                        type="button"
                                        className="btn btn-primary w-100 py-2 fw-semibold shadow-sm"
                                        onClick={finishAndSignIn}
                                    >
                                        Sign In Now
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        )}
    </div>
  );
}
