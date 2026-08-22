import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function EmployeeSignup() {
  const [orgCode, setOrgCode] = useState('');
  const [empName, setEmpName] = useState('');
  const [empEmail, setEmpEmail] = useState('');
  const [empPassword, setEmpPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

                <div className="d-flex justify-content-center mb-3">
                    <button className="btn btn-outline-secondary w-100 py-2 fw-bold">
                        <i className="bi bi-google me-2"></i> Join with Google
                    </button>
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
