import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function OrganizationSignup() {
  const [orgName, setOrgName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [orgEmail, setOrgEmail] = useState('');
  const [orgPassword, setOrgPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [successCode, setSuccessCode] = useState('');
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = {
        name: orgName,
        managerName: managerName,
        email: orgEmail,
        password: orgPassword
      };
      
      const response = await api.post('/signup-org', payload);
      if (response.success && response.orgCode) {
        setSuccessCode(response.orgCode);
      } else {
        setError(response.message || 'Failed to register organization.');
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
            <div className="auth-glow-orb orb-1"></div>
            <div className="auth-glow-orb orb-2" style={{background: 'var(--success)'}}></div>
            
            <div className="auth-brand-content">
                <div className="auth-brand-icon">
                    <i className="bi bi-building"></i>
                </div>
                <h1 className="fw-bold display-5 mb-3">Enterprise Setup</h1>
                <p className="auth-tagline">
                    Create your organization space in seconds. Invite your employees, track engagement metrics instantly, and optimize your company's meetings across the board.
                </p>
            </div>
        </div>

        <div className="auth-form-panel">
            <div className="auth-form-card text-center">
                <h3 className="fw-bold mb-1">Create Organization</h3>
                <p className="text-muted mb-4">Register your company to get started</p>

                {error && <div className="alert alert-danger text-start small mb-3">{error}</div>}

                {successCode ? (
                  <div className="alert alert-success text-center rounded-3 mt-4" role="alert">
                      <div className="mb-2"><i className="bi bi-check-circle-fill fs-2 text-success"></i></div>
                      <strong>Success!</strong> Your Organization Code is: <br />
                      <h3 className="fw-bold mt-2 text-success tracking-widest" style={{letterSpacing: '2px'}}>{successCode}</h3>
                      <p className="mb-0 small mt-2">Save this code! Your employees need it to join.</p>
                      <Link to="/" className="btn btn-success w-100 mt-3 fw-semibold">Go to Login</Link>
                  </div>
                ) : (
                  <>
                    <form className="text-start" onSubmit={handleSubmit}>
                        <div className="mb-3">
                            <label htmlFor="orgName" className="form-label fw-semibold text-muted small mb-1">ORGANIZATION NAME</label>
                            <input type="text" className="form-control auth-input" id="orgName" placeholder="Enter organization name" required
                                   value={orgName} onChange={e => setOrgName(e.target.value)} />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="managerName" className="form-label fw-semibold text-muted small mb-1">MANAGER NAME</label>
                            <input type="text" className="form-control auth-input" id="managerName" placeholder="Enter manager name" required
                                   value={managerName} onChange={e => setManagerName(e.target.value)} />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="orgEmail" className="form-label fw-semibold text-muted small mb-1">MANAGER EMAIL</label>
                            <input type="email" className="form-control auth-input" id="orgEmail" placeholder="Enter manager email" required
                                   value={orgEmail} onChange={e => setOrgEmail(e.target.value)} />
                        </div>
                        <div className="mb-3">
                            <label htmlFor="orgPassword" className="form-label fw-semibold text-muted small mb-1">PASSWORD</label>
                            <input type="password" className="form-control auth-input" id="orgPassword" placeholder="Enter password" required
                                   value={orgPassword} onChange={e => setOrgPassword(e.target.value)} />
                        </div>
                        <button type="submit" className="btn btn-primary w-100 py-2 fw-bold shadow-sm mb-3" disabled={loading}>
                            <i className="bi bi-building-add me-1"></i> {loading ? 'Registering...' : 'Register Organization'}
                        </button>
                    </form>

                    <div className="d-flex align-items-center my-3">
                        <hr className="flex-grow-1 text-muted opacity-25" />
                        <span className="px-2 text-muted extra-small text-uppercase fw-semibold" style={{fontSize: '0.75rem'}}>OR SIGNUP WITH GOOGLE</span>
                        <hr className="flex-grow-1 text-muted opacity-25" />
                    </div>
                    
                    <div className="d-flex justify-content-center mb-3">
                        <button className="btn btn-outline-secondary w-100 py-2 fw-bold">
                            <i className="bi bi-google me-2"></i> Sign Up with Google
                        </button>
                    </div>
                  </>
                )}
                
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
