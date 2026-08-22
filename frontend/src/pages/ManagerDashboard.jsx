import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import Sidebar from '../components/Sidebar';

export default function ManagerDashboard() {
  const [data, setData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [session, setSession] = useState({ active: false, code: '' });
  const [loading, setLoading] = useState(true);
  const [managerName, setManagerName] = useState('Manager');
  
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('uuid_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('username');
    navigate('/');
  };

  const fetchData = async () => {
    try {
      const sessionRes = await api.get('/active-session');
      if (sessionRes && sessionRes.active) {
        setSession({ active: true, code: sessionRes.sessionCode || '' });
      } else {
        setSession({ active: false, code: '' });
      }

      const engRes = await api.get('/engagement');
      if (engRes && engRes.success === false && engRes.status === 401) {
        handleLogout();
        return;
      }
      if (Array.isArray(engRes)) {
        setData([...engRes].reverse());
      }

      const alertsRes = await api.get('/alerts');
      if (Array.isArray(alertsRes)) {
        setAlerts(alertsRes);
      }
    } catch (err) {
      if (err.name !== 'AbortError' && err.message !== 'Failed to fetch') {
        console.error("Dashboard error:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('uuid_token');
    const role = localStorage.getItem('user_role');
    if (!token || (role !== 'MANAGER' && role !== 'ADMIN')) {
      navigate('/');
      return;
    }
    
    const name = localStorage.getItem('username');
    if (name) setManagerName(name);

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleStartSession = async () => {
    try {
      const response = await api.post('/start');
      if (response.success) {
        setSession({ active: true, code: response.sessionCode });
        fetchData();
      } else {
        alert("Failed to start session: " + (response.message || "Unknown error"));
      }
    } catch (e) {
      alert("Error starting backend session.");
    }
  };

  const handleStopSession = async () => {
    if (window.confirm("Are you sure you want to end the current monitoring session for all participants?")) {
      try {
        await api.post('/stop');
        setSession({ active: false, code: '' });
        fetchData();
      } catch (e) {
        alert("Error communicating with backend server.");
      }
    }
  };

  const getEmpScore = (emp) => {
    if (!emp) return 0;
    if (emp.score !== undefined && emp.score !== null) return Number(emp.score);
    if (emp.attentionScore !== undefined && emp.attentionScore !== null) return Math.round(Number(emp.attentionScore) * 100);
    return 0;
  };

  const getEmpDuration = (emp) => {
    if (!emp) return 0;
    if (emp.durationSeconds !== undefined && emp.durationSeconds !== null) return Number(emp.durationSeconds);
    if (emp.duration !== undefined && emp.duration !== null) return Number(emp.duration);
    return 0;
  };

  const getEmpWindow = (emp) => {
    if (!emp) return 'Meeting Workspace';
    return emp.activeWindow || emp.window || 'Meeting Workspace';
  };

  const getEmpWebcam = (emp) => {
    if (!emp) return false;
    if (emp.webcamActive !== undefined) return Boolean(emp.webcamActive);
    if (emp.webcam !== undefined) return Boolean(emp.webcam);
    return false;
  };

  const uniqueEmployees = new Set(data.map(emp => emp?.name || 'Employee')).size;
  const avgEngagement = data.length > 0 
    ? Math.round(data.reduce((sum, emp) => sum + getEmpScore(emp), 0) / data.length) 
    : 0;

  const mostEngaged = data.length > 0 
    ? [...data].sort((a, b) => getEmpScore(b) - getEmpScore(a))[0]?.name || '-' 
    : '-';

  const mostDistracted = data.length > 0 
    ? [...data].sort((a, b) => getEmpScore(a) - getEmpScore(b))[0]?.name || '-' 
    : '-';

  const avgDurationMinutes = data.length > 0 
    ? Math.floor((data.reduce((sum, emp) => sum + getEmpDuration(emp), 0) / data.length) / 60) 
    : 0;

  return (
    <>
      <Sidebar />

      {/* Main Content */}
      <main className="main-content">
          <header className="top-navbar mb-4 rounded-3 glass-card">
              <div className="d-flex align-items-center">
                  <h4 className="mb-0 fw-bold">Overview</h4>
                  
                  {!session.active ? (
                    <button className="btn btn-primary ms-4 shadow" onClick={handleStartSession}>
                        <i className="bi bi-play-circle me-2"></i>Start Meeting Session
                    </button>
                  ) : (
                    <>
                        <button className="btn btn-danger ms-4 shadow" onClick={handleStopSession}>
                            <i className="bi bi-stop-circle me-2"></i>Stop Meeting Session
                        </button>
                        <div className="ms-4 px-3 py-1 bg-success bg-opacity-10 border border-success rounded text-success">
                            <span className="fw-bold">Session Code: </span>
                            <span className="fw-bold fs-5 tracking-widest">{session.code}</span>
                        </div>
                    </>
                  )}
              </div>
              <div className="d-flex align-items-center gap-3">
                  {/* Notifications Dropdown */}
                  <div className="dropdown">
                      <button className="btn btn-link text-muted p-0 position-relative" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                          <i className="bi bi-bell-fill fs-5"></i>
                          {alerts.length > 0 && (
                              <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle">
                                  <span className="visually-hidden">New alerts</span>
                              </span>
                          )}
                      </button>
                      <ul className="dropdown-menu dropdown-menu-end shadow-sm" style={{ width: '300px', maxHeight: '400px', overflowY: 'auto' }}>
                          <li><h6 className="dropdown-header">Recent Notifications</h6></li>
                          <li><hr className="dropdown-divider" /></li>
                          {alerts.length === 0 ? (
                              <li><span className="dropdown-item text-muted text-center">No new notifications</span></li>
                          ) : (
                              alerts.map((a, i) => (
                                  <li key={i}>
                                      <span className="dropdown-item d-flex flex-column gap-1">
                                          <span className="fw-bold text-dark">{a?.name || 'Alert'}</span>
                                          <span className="small text-muted">{a?.reason || a?.message || 'Low engagement detected'}</span>
                                      </span>
                                  </li>
                              ))
                          )}
                      </ul>
                  </div>

                  {/* Profile Dropdown */}
                  <div className="dropdown ms-2">
                      <button className="btn btn-link p-0 border-0 shadow-sm rounded-circle" data-bs-toggle="dropdown" aria-expanded="false" title="Manager Profile">
                          <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(managerName)}&background=7c3aed&color=fff`} alt="Profile" className="rounded-circle" width="40" height="40" />
                      </button>
                      <div className="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 mt-2" style={{ width: '340px', padding: '0', overflow: 'hidden' }}>
                          <div className="text-center p-4 bg-light border-bottom">
                              <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(managerName)}&background=7c3aed&color=fff&size=80`} alt="Profile" className="rounded-circle shadow-sm mb-3 border border-3 border-white" />
                              <h5 className="fw-bold mb-1">{managerName}</h5>
                              <p className="text-primary fw-medium small tracking-widest mb-0">MANAGER</p>
                          </div>

                          <div className="p-3 bg-white">
                              <div className="d-flex justify-content-between align-items-center bg-light p-3 rounded-3 mb-3 border">
                                  <div>
                                      <h6 className="text-muted small text-uppercase fw-bold mb-1" style={{ fontSize: '0.7rem' }}>Org Code</h6>
                                      <span className="fw-bold tracking-widest text-dark" id="profileOrgCode">MLD-ORG-X</span>
                                  </div>
                                  <button className="btn btn-outline-primary btn-sm rounded-pill px-3" style={{ fontSize: '0.75rem' }} onClick={() => alert('Copied!')}>
                                      <i className="bi bi-clipboard me-1"></i>Copy
                                  </button>
                              </div>

                              <button className="dropdown-item py-2 px-3 rounded-2 mb-1 fw-medium" data-bs-toggle="modal" data-bs-target="#manageEmployeesModal">
                                  <i className="bi bi-people-fill text-primary me-3 fs-5 align-middle"></i>Manage Employees
                              </button>
                              <button className="dropdown-item py-2 px-3 rounded-2 fw-medium" onClick={() => alert('Settings module coming soon!')}>
                                  <i className="bi bi-gear-fill text-muted me-3 fs-5 align-middle"></i>Account Settings
                              </button>
                          </div>

                          <div className="p-2 border-top bg-light">
                              <button onClick={handleLogout} className="dropdown-item py-2 px-3 rounded-2 text-danger fw-medium d-flex justify-content-center align-items-center w-100 border-0 bg-transparent">
                                  <i className="bi bi-box-arrow-right me-2"></i>Sign Out
                              </button>
                          </div>
                      </div>
                  </div>
              </div>
          </header>
          {session.active ? (
              <div className="row mt-5">
                  <div className="col-12 text-center">
                      <div className="card glass-card border-primary shadow-sm py-5" style={{borderWidth: '2px'}}>
                          <div className="card-body">
                              <div className="spinner-grow text-primary mb-4" style={{ width: '4rem', height: '4rem' }} role="status"></div>
                              <h2 className="fw-bold mb-3">Meeting Session in Progress...</h2>
                              <p className="text-muted fs-5 mb-0">Employee telemetry is being actively recorded on their local machines.</p>
                              <p className="text-muted fs-5">Full analytics will be aggregated and displayed here automatically once you stop the session.</p>
                          </div>
                      </div>
                  </div>
              </div>
          ) : (
              <>
                  <div className="row g-4 row-cols-1 row-cols-md-2 row-cols-xl-4 mb-4">
              <div className="col">
                  <div className="card glass-card h-100">
                      <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="card-subtitle text-muted">Total Monitored</h6>
                              <div className="bg-primary bg-opacity-10 p-2 rounded text-primary">
                                  <i className="bi bi-people-fill"></i>
                              </div>
                          </div>
                          <h2 className="metric-value">{uniqueEmployees}</h2>
                          <span className="text-success small"><i className="bi bi-arrow-up-short"></i> Based on active records</span>
                      </div>
                  </div>
              </div>
              <div className="col">
                  <div className="card glass-card h-100">
                      <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="card-subtitle text-muted">Avg Engagement</h6>
                              <div className="bg-info bg-opacity-10 p-2 rounded text-info">
                                  <i className="bi bi-activity"></i>
                              </div>
                          </div>
                          <h2 className="metric-value">{avgEngagement}%</h2>
                          <span className="text-success small"><i className="bi bi-arrow-up-short"></i> Across all active participants</span>
                      </div>
                  </div>
              </div>
              <div className="col">
                  <div className="card glass-card h-100">
                      <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="card-subtitle text-muted">Active Meetings</h6>
                              <div className="bg-warning bg-opacity-10 p-2 rounded text-warning">
                                  <i className="bi bi-camera-video-fill"></i>
                              </div>
                          </div>
                          <h2 className="metric-value">{session.active ? 1 : 0}</h2>
                          <span className="text-muted small">Live right now</span>
                      </div>
                  </div>
              </div>
              <div className="col">
                  <div className="card glass-card h-100">
                      <div className="card-body">
                          <div className="d-flex justify-content-between align-items-center mb-3">
                              <h6 className="card-subtitle text-muted">Low Engagement Alerts</h6>
                              <div className="bg-danger bg-opacity-10 p-2 rounded text-danger">
                                  <i className="bi bi-exclamation-triangle-fill"></i>
                              </div>
                          </div>
                          <h2 className="metric-value text-danger">{alerts.length}</h2>
                          <span className="text-danger small">Requires attention</span>
                      </div>
                  </div>
              </div>
          </div>

          <div className="row g-4 mb-4">
              <div className="col-lg-8">
                  <div className="card glass-card h-100">
                      <div className="card-header bg-transparent border-bottom border-secondary d-flex justify-content-between align-items-center py-3">
                          <h5 className="mb-0 fw-bold">{session.active ? "Live Employee Engagement" : "Historical Session Engagement"}</h5>
                          <div className="d-flex gap-2">
                              <a href="#/reports" className="btn btn-sm btn-outline-primary shadow-sm">View Reports</a>
                          </div>
                      </div>
                      <div className="card-body p-0">
                          <div className="table-responsive">
                              <table className="table table-hover align-middle mb-0">
                                  <thead className="bg-transparent text-nowrap">
                                      <tr>
                                          <th scope="col" className="ps-4">Employee</th>
                                          <th scope="col">Active Window</th>
                                          <th scope="col">Session Code</th>
                                          <th scope="col">Webcam</th>
                                          <th scope="col">Idle Time</th>
                                          <th scope="col">Duration</th>
                                          <th scope="col">Engagement Score</th>
                                          <th scope="col">Status</th>
                                      </tr>
                                  </thead>
                                  <tbody>
                                      {loading && data.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center py-4 text-muted">
                                                <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                                Connecting to Backend Server...
                                            </td>
                                        </tr>
                                      ) : data.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center py-4 text-muted">
                                                {session.active ? "Waiting for employee telemetry data..." : "No active meeting session."}
                                            </td>
                                        </tr>
                                      ) : (
                                        data.map((emp, i) => {
                                            const score = getEmpScore(emp);
                                            const scoreColor = score < 50 ? 'danger' : (score < 80 ? 'warning' : 'success');
                                            const winStr = getEmpWindow(emp);
                                            const isMeetingWin = winStr.toLowerCase().includes('google meet') || winStr.toLowerCase().includes('meet') || winStr.toLowerCase().includes('zoom') || winStr.toLowerCase().includes('teams');
                                            const windowBadge = isMeetingWin ? 'primary' : 'secondary';
                                            const statusBadge = score < 50 ? 'danger' : 'success';
                                            const statusText = emp.status || (score < 50 ? 'Distracted' : 'Engaged');
                                            const isCam = getEmpWebcam(emp);
                                            const durSec = getEmpDuration(emp);
                                            const idleSec = Number(emp.idleSeconds || 0);
                                            
                                            return (
                                                <tr key={i}>
                                                    <td className="ps-4 fw-medium">{emp.name || 'Employee'}</td>
                                                    <td><span className={`badge bg-${windowBadge} bg-opacity-10 text-${windowBadge}`}>{winStr}</span></td>
                                                    <td className="font-monospace text-muted">{emp.sessionCode || session.code || '-'}</td>
                                                    <td>
                                                        {isCam ? (
                                                            <span className="badge-soft-success px-2 py-1 rounded"><i className="bi bi-camera-video me-1"></i> ON</span>
                                                        ) : (
                                                            <span className="badge-soft-danger px-2 py-1 rounded"><i className="bi bi-camera-video-off me-1"></i> OFF</span>
                                                        )}
                                                    </td>
                                                    <td className={idleSec > 10 ? 'text-danger fw-bold' : ''}>{idleSec}s</td>
                                                    <td>{Math.floor(durSec / 60)}m {durSec % 60}s</td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="progress flex-grow-1" style={{height: '6px'}}>
                                                                <div className={`progress-bar bg-${scoreColor}`} role="progressbar" style={{width: `${Math.min(100, Math.max(0, score))}%`}}></div>
                                                            </div>
                                                            <span className={`fw-bold text-${scoreColor}`} style={{minWidth: '40px'}}>{score}%</span>
                                                        </div>
                                                    </td>
                                                    <td><span className={`badge bg-${statusBadge}`}>{statusText}</span></td>
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

              <div className="col-lg-4">
                  <div className="card glass-card h-100">
                      <div className="card-header bg-transparent border-bottom border-secondary py-3">
                          <h5 className="mb-0 fw-bold">Recent Alerts</h5>
                      </div>
                      <div className="card-body">
                          {alerts.length === 0 ? (
                              <div className="text-center py-4 text-muted">No alerts at this time.</div>
                          ) : (
                              alerts.map((alert, i) => (
                                  <div key={i} className="alert-item">
                                      <div>
                                          <strong>{alert.name || 'Participant'}</strong>
                                          <div className="small text-muted mt-1">{alert.message || alert.reason || 'Low attention score'}</div>
                                      </div>
                                      <span className="badge bg-danger rounded-pill">New</span>
                                  </div>
                              ))
                          )}
                      </div>
                      <div className="card-footer bg-transparent border-top border-secondary text-center py-3">
                          <a href="#/alerts" className="text-decoration-none text-primary fw-medium">View All Alerts <i className="bi bi-arrow-right"></i></a>
                      </div>
                  </div>
              </div>
          </div>

          {/* Latest Meeting Summary */}
          <div className="row g-4 mb-4">
              <div className="col-12">
                  <div className="card glass-card">
                      <div className="card-header bg-transparent border-bottom border-secondary py-3">
                          <h5 className="mb-0 fw-bold">Latest Meeting Summary <span className="badge bg-primary ms-2">{avgEngagement}%</span></h5>
                      </div>
                      <div className="card-body">
                          {data.length === 0 ? (
                              <div className="text-muted text-center py-4">Waiting for meeting data...</div>
                          ) : (
                              <div className="row text-center">
                                  <div className="col-md-3 border-end border-secondary">
                                      <h6 className="text-muted">Total Participants</h6>
                                      <h3 className="fw-bold">{uniqueEmployees}</h3>
                                  </div>
                                  <div className="col-md-3 border-end border-secondary">
                                      <h6 className="text-muted">Most Engaged</h6>
                                      <h3 className="fw-bold text-success">{mostEngaged}</h3>
                                  </div>
                                  <div className="col-md-3 border-end border-secondary">
                                      <h6 className="text-muted">Most Distracted</h6>
                                      <h3 className="fw-bold text-danger">{mostDistracted}</h3>
                                  </div>
                                  <div className="col-md-3">
                                      <h6 className="text-muted">Average Duration</h6>
                                      <h3 className="fw-bold text-primary">{avgDurationMinutes}m</h3>
                                  </div>
                              </div>
                          )}
                      </div>
                  </div>
              </div>
          </div>
              </>
          )}
      </main>

      {/* Manage Employees Modal */}
      <div className="modal fade" id="manageEmployeesModal" tabIndex="-1" aria-hidden="true">
          <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
              <div className="modal-content bg-white border-0 shadow">
                  <div className="modal-header border-bottom">
                      <h5 className="modal-title fw-bold"><i className="bi bi-people me-2 text-primary"></i>Manage Employees</h5>
                      <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                  </div>
                  <div className="modal-body p-0">
                      <div className="table-responsive">
                          <table className="table table-hover align-middle mb-0">
                              <thead className="bg-light">
                                  <tr>
                                      <th className="ps-4">Employee Name</th>
                                      <th>Email</th>
                                      <th>Joined At</th>
                                      <th className="text-end pe-4">Actions</th>
                                  </tr>
                              </thead>
                              <tbody>
                                  <tr>
                                      <td colSpan="4" className="text-center py-4 text-muted">No employees registered yet.</td>
                                  </tr>
                              </tbody>
                          </table>
                      </div>
                  </div>
                  <div className="modal-footer border-top bg-light">
                      <button className="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                  </div>
              </div>
          </div>
      </div>
    </>
  );
}
