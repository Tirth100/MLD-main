import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';

export default function EmployeeDashboard() {
  const [session, setSession] = useState({ active: false, code: '' });
  const [joinCode, setJoinCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [profileName, setProfileName] = useState('Loading...');
  const [history, setHistory] = useState([]);
  const [timelineData, setTimelineData] = useState([]);
  const [showModal, setShowModal] = useState(false);
  
  const [dashboardData, setDashboardData] = useState({
    attentionScore: 0,
    webcam: false,
    duration: 0,
    idleSeconds: 0,
    windowFocus: [0, 0, 100], // For focus bar
    chatActivity: [0,0,0,0,0,0],
    speakingData: [0,0,0,0]
  });
  
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('uuid_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('username');
    navigate('/');
  };

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('uuid_token') || '';
      const sessionRes = await api.get('/active-session?uuid=' + encodeURIComponent(token));
      if (sessionRes && sessionRes.active) {
        setSession({ active: true, code: sessionRes.sessionCode });
      } else {
        setSession({ active: false, code: '' });
      }

      if (sessionRes && sessionRes.active) {
        const engRes = await api.get('/engagement');
        if (Array.isArray(engRes) && engRes.length > 0) {
          const username = localStorage.getItem('username');
          const currentEmp = engRes.find(emp => (username && emp.name === username) || emp.isLive) || engRes[0];
          setDashboardData({
            attentionScore: currentEmp.score !== undefined ? (Number(currentEmp.score) > 1 ? Number(currentEmp.score) / 100 : Number(currentEmp.score)) : (currentEmp.attentionScore !== undefined ? Number(currentEmp.attentionScore) : 1.0),
            webcam: currentEmp.webcamActive !== undefined ? Boolean(currentEmp.webcamActive) : Boolean(currentEmp.webcam),
            duration: currentEmp.durationSeconds !== undefined ? Number(currentEmp.durationSeconds) : (currentEmp.duration !== undefined ? Number(currentEmp.duration) : 0),
            idleSeconds: currentEmp.idleSeconds !== undefined ? Number(currentEmp.idleSeconds) : 0,
            activeWindow: currentEmp.activeWindow || currentEmp.window || 'Meeting Workspace',
            status: currentEmp.status || 'Engaged'
          });
        }
      }

      const engData = await api.get('/engagement');
      if (Array.isArray(engData)) {
          const username = localStorage.getItem('username');
          const myHistory = engData.filter(emp => !username || emp.name === username);
          setHistory(myHistory.reverse());
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
    const name = localStorage.getItem('username');
    if (name) setProfileName(name);

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleJoin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      const uuid = localStorage.getItem('uuid_token') || '';
      const response = await api.post('/join', { sessionCode: joinCode, uuid });
      if (response.success) {
        setSession({ active: true, code: joinCode });
        
        // Automatically trigger the agent deep link
        if (uuid) {
            window.location.href = `mld-agent://link?token=${uuid}`;
        }
        
        fetchStatus();
      } else {
        setError(response.message || 'Failed to join session.');
      }
    } catch (err) {
      setError('Network error connecting to session.');
    }
  };

  const handleLeave = async () => {
    if (window.confirm("Are you sure you want to leave the active session?")) {
        const uuid = localStorage.getItem('uuid_token') || '';
        try {
            await api.post('/leave-session', { uuid: uuid });
        } catch(e) {}
        setSession({ active: false, code: '' });
    }
  };

  const openTimeline = (timeline) => {
      setTimelineData(timeline || []);
      setShowModal(true);
  };

  const overallScore = Math.round((dashboardData.attentionScore || 0) * 100);
  const scoreColor = overallScore < 50 ? 'danger' : 'success';

  return (
    <div id="employeeDashboard" style={{ minHeight: '100vh', backgroundColor: '#f8f9fa' }}>
      
      {/* Top Navbar */}
      <nav className="navbar navbar-expand-lg border-bottom border-secondary" style={{ background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)' }}>
          <div className="container-fluid px-4 py-1">
              <a className="navbar-brand d-flex align-items-center text-dark" href="#">
                  <i className="bi bi-radar text-primary fs-3 me-2"></i>
                  <span className="fs-5 fw-bold">MLD Employee</span>
              </a>
              <div className="d-flex align-items-center gap-4">
                  <Link to="/agent-setup" className="btn btn-sm btn-outline-primary shadow-sm"><i className="bi bi-download me-1"></i>Agent Setup</Link>
                  <div className="d-flex align-items-center gap-2 border-start ps-3">
                      <img id="employeeProfileImg" src={`https://ui-avatars.com/api/?name=${encodeURIComponent(profileName)}&background=0ea5e9&color=fff`} alt="Profile" className="rounded-circle shadow-sm" width="36" height="36" />
                      <span id="employeeProfileName" className="fw-bold text-dark me-2">{profileName}</span>
                      <button onClick={handleLogout} className="btn btn-sm btn-danger shadow-sm"><i className="bi bi-box-arrow-left me-1"></i>Logout</button>
                  </div>
              </div>
          </div>
      </nav>

      {/* Main Content */}
      <main className="container-fluid px-4 py-4" style={{ marginLeft: 0 }}>
          
          <div className="row mb-4">
              <div className="col-12">
                  <div className="card glass-card bg-primary bg-opacity-10 border-primary border-opacity-25">
                      <div className="card-body d-flex justify-content-between align-items-center flex-wrap gap-3">
                          <div>
                              <h5 className="fw-bold mb-1"><i className="bi bi-camera-video-fill text-warning me-2"></i>Meeting Status</h5>
                              {loading ? (
                                <p className="text-muted mb-0">Connecting to Server <div className="spinner-border spinner-border-sm ms-1" role="status"></div></p>
                              ) : session.active ? (
                                <p className="text-success fw-bold mb-0">Monitoring Active for Session: {session.code}</p>
                              ) : (
                                <p className="text-muted mb-0">Waiting for Session Code...</p>
                              )}
                          </div>
                          {!session.active && (
                            <form className="text-end d-flex gap-2 align-items-center" onSubmit={handleJoin}>
                                <input type="text" className="form-control text-uppercase" placeholder="Code (e.g. MLD123)" style={{ maxWidth: '200px' }} value={joinCode} onChange={e => setJoinCode(e.target.value)} required />
                                <button type="submit" className="btn btn-primary shadow"><i className="bi bi-box-arrow-in-right me-1"></i>Join Session</button>
                            </form>
                          )}
                      </div>
                      {error && <div className="alert alert-danger mx-3 mb-3">{error}</div>}
                  </div>
              </div>
          </div>

          {/* Desktop Agent Activation Card */}
          {session.active && (
            <div className="row mb-4">
                <div className="col-12">
                    <div className="card glass-card border-success border-2 shadow-sm">
                        <div className="card-body">
                            <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
                                <h5 className="fw-bold mb-0 text-success">
                                    <i className="bi bi-cpu-fill me-2"></i>MLD Desktop Agent Activated for Session <span className="badge bg-success">{session.code}</span>
                                </h5>
                                <button className="btn btn-sm btn-outline-danger shadow-sm" onClick={handleLeave}>
                                    <i className="bi bi-box-arrow-right me-1"></i>Leave Session
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
          )}

          <div className="row g-4 mb-4">
              {/* Overall Score Card */}
              <div className="col-lg-12">
                  <div className="card glass-card">
                      <div className="card-body text-center py-5">
                          <h4 className="card-title fw-bold mb-4">Your Current Engagement Score</h4>
                          <div className={`display-1 fw-bold text-${scoreColor} mb-4`}>{overallScore}%</div>
                          
                          <div className="progress" style={{ height: '20px', maxWidth: '600px', margin: '0 auto', backgroundColor: 'rgba(255,255,255,0.05)' }}>
                              <div className={`progress-bar progress-bar-striped progress-bar-animated bg-${scoreColor}`} role="progressbar" style={{ width: `${overallScore}%` }}></div>
                          </div>
                          <p className="text-muted mt-3">Aim to keep this above 50% to avoid low engagement alerts.</p>
                      </div>
                  </div>
              </div>
          </div>

          <div className="row g-4">
              {/* Focus Score */}
              <div className="col-md-4">
                  <div className="card glass-card h-100 border-top border-success border-4">
                      <div className="card-body">
                          <h6 className="text-muted mb-3"><i className="bi bi-laptop me-2"></i>Window Focus</h6>
                          <h3 className="fw-bold mb-3">{overallScore}%</h3>
                          <div className="progress mb-2">
                              <div className="progress-bar bg-success" role="progressbar" style={{ width: `${overallScore}%` }}></div>
                          </div>
                          <small className="text-muted">Percentage of time meeting window is active.</small>
                      </div>
                  </div>
              </div>
              
              {/* Webcam Status */}
              <div className="col-md-4">
                  <div className="card glass-card h-100 border-top border-info border-4">
                      <div className="card-body">
                          <h6 className="text-muted mb-3"><i className="bi bi-camera-video me-2"></i>Webcam Status</h6>
                          <h3 className="fw-bold mb-3">
                              {dashboardData.webcam ? (
                                  <span className="badge bg-success bg-opacity-10 text-success border border-success"><i className="bi bi-camera-video-fill me-1"></i>ACTIVE (ON)</span>
                              ) : (
                                  <span className="badge bg-danger bg-opacity-10 text-danger border border-danger"><i className="bi bi-camera-video-off-fill me-1"></i>INACTIVE (OFF)</span>
                              )}
                          </h3>
                          <div className="progress mb-2">
                              <div className={`progress-bar ${dashboardData.webcam ? 'bg-info' : 'bg-danger'}`} role="progressbar" style={{ width: '100%' }}></div>
                          </div>
                          <small className="text-muted">Camera ON/OFF participation status.</small>
                      </div>
                  </div>
              </div>

              {/* Duration & Idle Time */}
              <div className="col-md-4">
                  <div className="card glass-card h-100 border-top border-warning border-4">
                      <div className="card-body">
                          <h6 className="text-muted mb-3"><i className="bi bi-clock-history me-2"></i>Session Duration & Idle Time</h6>
                          <h3 className="fw-bold mb-1">{Math.floor((dashboardData.duration || 0) / 60)}m {(dashboardData.duration || 0) % 60}s</h3>
                          <p className="text-muted small mb-2">Idle: {dashboardData.idleSeconds || 0}s</p>
                          <div className="progress mb-2">
                              <div className="progress-bar bg-warning" role="progressbar" style={{ width: '100%' }}></div>
                          </div>
                          <small className="text-muted">Active session participation time.</small>
                      </div>
                  </div>
              </div>
          </div>

          <div className="row mt-5 mb-4">
              <div className="col-12">
                  <h4 className="fw-bold mb-3">My Meeting History</h4>
                  <div className="card glass-card border-0">
                      <div className="card-body p-0">
                          <div className="table-responsive">
                              <table className="table table-hover align-middle mb-0">
                                  <thead className="bg-transparent">
                                      <tr>
                                          <th scope="col" className="ps-4">Name</th>
                                          <th scope="col">Role</th>
                                          <th scope="col">Score</th>
                                          <th scope="col">Status</th>
                                          <th scope="col">Actions</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {loading && history.length === 0 ? (
                                          <tr>
                                              <td colSpan="5" className="text-center py-4 text-muted">
                                                  <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                                  Loading history...
                                              </td>
                                          </tr>
                                      ) : history.length === 0 ? (
                                          <tr>
                                              <td colSpan="5" className="text-center py-4 text-muted">No history records found.</td>
                                          </tr>
                                      ) : (
                                          history.map((emp, i) => {
                                              const badgeClass = emp.status === 'engaged' ? 'success' : (emp.status === 'low engagement' ? 'danger' : 'warning');
                                              return (
                                                  <tr key={i}>
                                                      <td className="ps-4">{emp.name}</td>
                                                      <td>{emp.role}</td>
                                                      <td><span className="fw-bold">{emp.score}%</span></td>
                                                      <td><span className={`badge badge-soft-${badgeClass} px-3 py-2 rounded-pill text-capitalize`}>{emp.status}</span></td>
                                                      <td>
                                                          <button className="btn btn-sm btn-outline-primary" onClick={() => openTimeline(emp.timeline)}>Actions</button>
                                                      </td>
                                                  </tr>
                                              );
                                          })
                                      )}
                                  </tbody>
                              </table>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </main>

      {/* Timeline Modal */}
      {showModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div className="modal-content bg-white border-secondary">
                    <div className="modal-header border-secondary">
                        <h5 className="modal-title">Session Timeline Activity</h5>
                        <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                    </div>
                    <div className="modal-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th className="ps-4">Time (s)</th>
                                        <th>Active Window</th>
                                        <th>Classification</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timelineData.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="text-center py-4 text-muted">No timeline activity stored.</td>
                                        </tr>
                                    ) : (
                                        timelineData.map((check, index) => {
                                            const timeSec = index * 10;
                                            const winName = check.window || "Desktop Workspace";
                                            const lowerWin = winName.toLowerCase();
                                            const isMeetingOrWorkspace = check.focused || 
                                                lowerWin.includes("zoom") || 
                                                (lowerWin.includes("meet") && !lowerWin.includes("meeting leech detector") && !lowerWin.includes("mld employee")) || 
                                                lowerWin.includes("powerpoint") ||
                                                lowerWin.includes("powerpnt");

                                            return (
                                                <tr key={index}>
                                                    <td className="ps-4">{timeSec}s</td>
                                                    <td><small className="text-secondary">{winName}</small></td>
                                                    <td>
                                                        {isMeetingOrWorkspace ? (
                                                            <span className="text-success fw-bold">Focused</span>
                                                        ) : (
                                                            <span className="text-danger">Distracted</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="modal-footer border-secondary">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
}
