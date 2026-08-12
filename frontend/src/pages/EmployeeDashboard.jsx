import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

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
      const sessionRes = await api.get('/active-session');
      if (sessionRes && sessionRes.active) {
        setSession({ active: true, code: sessionRes.sessionCode });
      } else {
        setSession({ active: false, code: '' });
      }

      if (sessionRes && sessionRes.active) {
        const engRes = await api.get('/engagement');
        if (Array.isArray(engRes) && engRes.length > 0) {
          setDashboardData(engRes[0]);
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
      <div className="d-flex flex-column justify-content-center align-items-center vh-100 text-center">
        <div className="spinner-border text-primary mb-3" style={{width: '3rem', height: '3rem'}} role="status"></div>
        <h4 className="fw-bold text-dark">Connecting to Backend Server...</h4>
        <p className="text-muted small w-50 mt-2">
            Because the backend is hosted on a free Render tier, it goes to sleep after 15 minutes of inactivity. 
            <strong> Waking it up can take up to 50 seconds.</strong> Please be patient!
        </p>
      </div>
    );
  }

  return (
    <>
      <nav className="navbar navbar-expand-lg top-navbar glass-card mx-3 mx-lg-4 mt-3 mt-lg-4 rounded-4 mb-4">
        <div className="container-fluid px-2">
            <a className="navbar-brand d-flex align-items-center gap-2 fw-bold text-primary" href="#">
                <div className="bg-primary text-white rounded p-1 d-flex align-items-center justify-content-center"
                    style={{ width: '32px', height: '32px' }}>
                    MLD
                </div>
                Employee Dashboard
                <span className="text-muted fw-normal fs-7 ms-2 d-none d-sm-inline">Meeting & Log System</span>
            </a>
            <div className="d-flex align-items-center gap-3">
                <button onClick={handleLogout} className="btn btn-light btn-sm fw-medium d-flex align-items-center gap-2">
                    <i className="bi bi-box-arrow-right"></i> Logout
                </button>
            </div>
        </div>
      </nav>

      <div className="container-fluid px-3 px-lg-4 pb-4">
          <div className="row justify-content-center">
              <div className="col-12 col-xl-10">
                  <div id="meetingStatusAlert" className={`alert ${session.active ? 'alert-primary' : 'alert-secondary'} shadow-sm mb-4`}>
                      <strong><i className="bi bi-camera-video-fill me-2"></i> MEETING STATUS</strong><br/>
                      {session.active ? (
                        <span className="text-success fw-bold">Active Monitoring Session ({session.code})</span>
                      ) : (
                        <span className="text-muted">No Active Session</span>
                      )}
                  </div>

                  {!session.active ? (
                    <div className="glass-card p-4 p-md-5 text-center mx-auto mt-5" style={{ maxWidth: '500px' }}>
                        <h4 className="fw-bold mb-3">Join a Session</h4>
                        <p className="text-muted mb-4 fs-7">Enter the code provided by your manager to begin the monitoring session.</p>
                        
                        {error && <div className="alert alert-danger text-start small mb-3">{error}</div>}

                        <form onSubmit={handleJoin}>
                            <div className="mb-4">
                                <input 
                                  type="text" 
                                  className="form-control form-control-lg text-center font-monospace text-uppercase" 
                                  placeholder="E.G., MLD123" 
                                  required
                                  value={joinCode}
                                  onChange={e => setJoinCode(e.target.value)}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary w-100 py-2 fw-bold shadow-sm">
                                Join Session
                            </button>
                        </form>
                    </div>
                  ) : (
                    <div className="row g-3 g-md-4 mb-4">
                        <div className="col-12 col-sm-6 col-xl-3">
                            <div className="glass-card p-4 h-100">
                                <div className="d-flex justify-content-between mb-3">
                                    <span className="text-muted fw-semibold fs-7 text-uppercase">Webcam Status</span>
                                    <div className="bg-primary bg-opacity-10 text-primary p-2 rounded">
                                        <i className="bi bi-camera-video"></i>
                                    </div>
                                </div>
                                <h3 className="metric-value mb-1">{dashboardData.webcam ? 'ACTIVE (ON)' : 'INACTIVE (OFF)'}</h3>
                                <div className="text-muted fs-7">Privacy mode enabled</div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-3">
                            <div className="glass-card p-4 h-100">
                                <div className="d-flex justify-content-between mb-3">
                                    <span className="text-muted fw-semibold fs-7 text-uppercase">Window Focus</span>
                                    <div className="bg-info bg-opacity-10 text-info p-2 rounded">
                                        <i className="bi bi-window"></i>
                                    </div>
                                </div>
                                <h3 className="metric-value mb-1">{Math.round((dashboardData.attentionScore || 0) * 100)}%</h3>
                                <div className="text-muted fs-7">Current engagement level</div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-3">
                            <div className="glass-card p-4 h-100">
                                <div className="d-flex justify-content-between mb-3">
                                    <span className="text-muted fw-semibold fs-7 text-uppercase">Session Duration</span>
                                    <div className="bg-success bg-opacity-10 text-success p-2 rounded">
                                        <i className="bi bi-clock-history"></i>
                                    </div>
                                </div>
                                <h3 className="metric-value mb-1">
                                  {Math.floor((dashboardData.duration || 0) / 60)}m {(dashboardData.duration || 0) % 60}s
                                </h3>
                                <div className="text-muted fs-7">Since joining</div>
                            </div>
                        </div>

                        <div className="col-12 col-sm-6 col-xl-3">
                            <div className="glass-card p-4 h-100">
                                <div className="d-flex justify-content-between mb-3">
                                    <span className="text-muted fw-semibold fs-7 text-uppercase">Idle Time</span>
                                    <div className="bg-danger bg-opacity-10 text-danger p-2 rounded">
                                        <i className="bi bi-keyboard"></i>
                                    </div>
                                </div>
                                <h3 className="metric-value text-danger mb-1">{dashboardData.idleSeconds || 0}s</h3>
                                <div className="text-muted fs-7">No input detected</div>
                            </div>
                        </div>
                    </div>
                  )}
              </div>
          </div>
      </div>
    </>
  );
}
