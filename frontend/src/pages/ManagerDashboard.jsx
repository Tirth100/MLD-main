import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function ManagerDashboard() {
  const [data, setData] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [session, setSession] = useState({ active: false, code: '' });
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('uuid_token');
    localStorage.removeItem('user_role');
    navigate('/');
  };

  const fetchData = async () => {
    try {
      const sessionRes = await api.get('/active-session');
      if (sessionRes && sessionRes.active) {
        setSession({ active: true, code: sessionRes.sessionCode });
      } else {
        setSession({ active: false, code: '' });
      }

      const engRes = await api.get('/engagement');
      if (engRes && engRes.success === false && engRes.status === 401) {
        handleLogout();
        return;
      }
      if (Array.isArray(engRes)) {
        setData(engRes.reverse());
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
      if (loading) setLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('uuid_token');
    const role = localStorage.getItem('user_role');
    if (!token || (role !== 'MANAGER' && role !== 'ADMIN')) {
      navigate('/');
      return;
    }

    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  const handleStartSession = async () => {
    try {
      const response = await api.post('/start');
      if (response.success) {
        setSession({ active: true, code: response.sessionCode });
      } else {
        alert("Failed to start session: " + response.message);
      }
    } catch (e) {
      alert("Error starting backend session.");
    }
  };

  const handleStopSession = async () => {
    if (window.confirm("Are you sure you want to end the current monitoring session for all participants?")) {
      try {
        await api.get('/stop');
        setSession({ active: false, code: '' });
        fetchData();
      } catch (e) {
        alert("Error communicating with backend server.");
      }
    }
  };

  const uniqueEmployees = new Set(data.map(emp => emp.name)).size;
  const avgEngagement = data.length > 0 
    ? Math.round(data.reduce((sum, emp) => sum + (emp.attentionScore * 100), 0) / data.length) 
    : 0;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  return (
    <>
      {/* Sidebar */}
      <nav className="sidebar d-none d-md-flex flex-column p-3">
          <a href="#" className="d-flex align-items-center mb-4 text-dark text-decoration-none px-3">
              <i className="bi bi-radar text-primary fs-3 me-2"></i>
              <span className="fs-5 fw-bold">MLD Admin</span>
          </a>
          <hr className="border-secondary mt-0" />
          <ul className="nav flex-column mb-auto">
              <li className="nav-item">
                  <a href="#" className="nav-link active">
                      <i className="bi bi-grid-1x2"></i> Dashboard
                  </a>
              </li>
              <li className="nav-item">
                  <a href="#" className="nav-link">
                      <i className="bi bi-graph-up"></i> Analytics
                  </a>
              </li>
              <li className="nav-item">
                  <a href="#" className="nav-link">
                      <i className="bi bi-file-earmark-text"></i> Reports
                  </a>
              </li>
              <li className="nav-item">
                  <a href="#" className="nav-link">
                      <i className="bi bi-bell"></i> Alerts
                      {alerts.length > 0 && <span className="badge bg-danger rounded-pill ms-auto">{alerts.length}</span>}
                  </a>
              </li>
          </ul>
          <hr className="border-secondary" />
          <div className="px-3 py-2">
              <button onClick={handleLogout} className="btn btn-outline-danger w-100">
                  <i className="bi bi-box-arrow-left me-2"></i>Logout
              </button>
          </div>
      </nav>

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
                  <button className="btn btn-link p-0 border-0 shadow-sm rounded-circle">
                      <img src="https://ui-avatars.com/api/?name=Admin&background=7c3aed&color=fff" alt="Profile"
                          className="rounded-circle" width="40" height="40" />
                  </button>
              </div>
          </header>

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
                          <span className="text-success small"><i className="bi bi-arrow-up-short"></i> Based on total records</span>
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
                          <span className="text-success small"><i className="bi bi-arrow-up-short"></i> Across all records</span>
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

          <div className="row g-4">
              <div className="col-lg-8">
                  <div className="card glass-card h-100">
                      <div className="card-header bg-transparent border-bottom border-secondary d-flex justify-content-between align-items-center py-3">
                          <h5 className="mb-0 fw-bold">Live Employee Engagement</h5>
                          <div className="d-flex gap-2">
                              <button className="btn btn-sm btn-outline-primary shadow-sm">View Reports</button>
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
                                      {data.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" className="text-center py-4 text-muted">
                                                {session.active ? "Waiting for employee data..." : "No active session."}
                                            </td>
                                        </tr>
                                      ) : (
                                        data.map((emp, i) => {
                                            let score = Math.round(emp.attentionScore * 100);
                                            let scoreColor = score < 50 ? 'danger' : (score < 80 ? 'warning' : 'success');
                                            let windowBadge = emp.window.toLowerCase().includes('google meet') || emp.window.toLowerCase().includes('meet') || emp.window.toLowerCase().includes('zoom') ? 'primary' : 'secondary';
                                            let statusBadge = score < 50 ? 'danger' : 'success';
                                            let statusText = score < 50 ? 'Distracted' : 'Engaged';
                                            
                                            return (
                                                <tr key={i}>
                                                    <td className="ps-4 fw-medium">{emp.name}</td>
                                                    <td><span className={`badge bg-${windowBadge} bg-opacity-10 text-${windowBadge}`}>{emp.window}</span></td>
                                                    <td className="font-monospace text-muted">{emp.sessionCode}</td>
                                                    <td>
                                                        {emp.webcam ? (
                                                            <span className="badge-soft-success px-2 py-1 rounded"><i className="bi bi-camera-video me-1"></i> ON</span>
                                                        ) : (
                                                            <span className="badge-soft-danger px-2 py-1 rounded"><i className="bi bi-camera-video-off me-1"></i> OFF</span>
                                                        )}
                                                    </td>
                                                    <td className={emp.idleSeconds > 10 ? 'text-danger fw-bold' : ''}>{emp.idleSeconds}s</td>
                                                    <td>{Math.floor(emp.duration / 60)}m {emp.duration % 60}s</td>
                                                    <td>
                                                        <div className="d-flex align-items-center gap-2">
                                                            <div className="progress flex-grow-1" style={{height: '6px'}}>
                                                                <div className={`progress-bar bg-${scoreColor}`} role="progressbar" style={{width: `${score}%`}}></div>
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
                                          <strong>{alert.name}</strong>
                                          <div className="small text-muted mt-1">{alert.message} (Score: {Math.round(alert.attentionScore * 100)}%)</div>
                                      </div>
                                      <span className="badge bg-danger rounded-pill">New</span>
                                  </div>
                              ))
                          )}
                      </div>
                  </div>
              </div>
          </div>
      </main>
    </>
  );
}
