import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api } from '../api';
import Sidebar from '../components/Sidebar';

export default function ManagerDashboard() {
    const [data, setData] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [session, setSession] = useState({ active: false, code: '' });
    const [loading, setLoading] = useState(true);
    const [managerName, setManagerName] = useState('Manager');
    const [orgCode, setOrgCode] = useState(localStorage.getItem('org_code') || '');
    const [copied, setCopied] = useState(false);
    const [expandedRows, setExpandedRows] = useState({});
    const [employees, setEmployees] = useState([]);
    const [selectedEmployees, setSelectedEmployees] = useState(new Set());
    const [showInviteModal, setShowInviteModal] = useState(false);

    const toggleRow = (name) => setExpandedRows(prev => ({ ...prev, [name]: !prev[name] }));
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem('uuid_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('username');
        localStorage.removeItem('org_code');
        navigate('/');
    };

    const fetchEmployees = async () => {
        try {
            const res = await api.get('/employees');
            if (Array.isArray(res)) {
                setEmployees(res);
            } else if (res && res.employees) {
                setEmployees(res.employees);
            }
        } catch (err) {
            console.error("Failed to fetch employees", err);
        }
    };

    const removeEmployee = async (empId) => {
        if (!window.confirm("Remove this participant from the workspace?")) return;
        try {
            const res = await api.post('/employees/remove', { id: empId.toString() });
            if (res && res.success) {
                setEmployees(prev => prev.filter(e => e.id !== empId));
            } else {
                alert(res?.message || "Failed to remove participant.");
            }
        } catch (e) {
            alert("Error communicating with server.");
        }
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

            fetchEmployees();
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
        const cachedOrg = localStorage.getItem('org_code');
        if (cachedOrg) setOrgCode(cachedOrg);

        api.get('/profile').then(res => {
            if (res) {
                if (res.name) {
                    setManagerName(res.name);
                    localStorage.setItem('username', res.name);
                }
                if (res.orgCode) {
                    setOrgCode(res.orgCode);
                    localStorage.setItem('org_code', res.orgCode);
                }
            }
        }).catch(() => { });

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
        if (window.confirm("End monitoring session for all participants?")) {
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
        if (emp.durationSeconds !== undefined && emp.durationSeconds !== null && Number(emp.durationSeconds) > 0) {
            return Number(emp.durationSeconds);
        }
        if (emp.duration !== undefined && emp.duration !== null && Number(emp.duration) > 0) {
            return Number(emp.duration);
        }
        if (emp.totalChecks && Number(emp.totalChecks) > 0) {
            return Number(emp.totalChecks) * 5;
        }
        if (Array.isArray(emp.timeline) && emp.timeline.length > 0) {
            return emp.timeline.length * 5;
        }
        return 0;
    };

    const formatDuration = (totalSec) => {
        if (!totalSec || totalSec <= 0) return '-';
        const mins = Math.floor(totalSec / 60);
        const secs = Math.floor(totalSec % 60);
        if (mins === 0) return `${secs}s`;
        if (secs === 0) return `${mins}m`;
        return `${mins}m ${secs}s`;
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

    // Group historical data
    const groupedData = !session.active ? data.reduce((acc, emp) => {
        const name = emp.name || 'Employee';
        if (!acc[name]) {
            acc[name] = {
                name,
                sessions: [],
                totalScore: 0,
                totalDuration: 0,
                lastSessionCode: emp.sessionCode,
                lastJoinedAt: emp.joinTime || emp.timestamp
            };
        }
        acc[name].sessions.push(emp);
        acc[name].totalScore += getEmpScore(emp);
        acc[name].totalDuration += getEmpDuration(emp);
        return acc;
    }, {}) : {};
    const historicalGroups = Object.values(groupedData);

    const avgEngagementColor = avgEngagement > 75 ? 'success' : (avgEngagement >= 50 ? 'warning' : 'danger');

    return (
        <>
            <Sidebar />

            <main className="main-content">
                {/* Header Navbar */}
                <header className="top-navbar rounded-4 glass-card mb-4 border-0 shadow-sm py-3 px-4">
                    <div className="d-flex align-items-center gap-3">
                        <div>
                            <h4 className="fw-bold mb-0 text-dark">Host Overview</h4>
                            <p className="text-muted small mb-0">Meeting Leech Detector Workspace</p>
                        </div>

                        {orgCode && (
                            <button
                                className="btn btn-sm btn-light border px-3 py-1.5 rounded-pill d-inline-flex align-items-center gap-2 shadow-xs"
                                onClick={() => {
                                    navigator.clipboard.writeText(orgCode);
                                    setCopied(true);
                                    setTimeout(() => setCopied(false), 2000);
                                }}
                                title="Click to copy Workspace Code"
                            >
                                <i className="bi bi-building text-primary"></i>
                                <span className="text-secondary small">Code:</span>
                                <strong className="text-primary font-monospace">{orgCode}</strong>
                                <i className={`bi ${copied ? 'bi-check2 text-success' : 'bi-copy'} text-muted small`}></i>
                            </button>
                        )}
                    </div>

                    <div className="d-flex align-items-center gap-3">
                        {/* Session Control Button */}
                        {!session.active ? (
                            <button className="btn btn-primary btn-sm px-3 py-2 rounded-pill shadow-sm d-flex align-items-center gap-2" onClick={handleStartSession}>
                                <i className="bi bi-play-circle-fill"></i>
                                <span>Start Session</span>
                            </button>
                        ) : (
                            <div className="d-flex align-items-center gap-2">
                                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill d-flex align-items-center gap-2">
                                    <span className="spinner-grow spinner-grow-sm text-success" role="status" style={{ width: '8px', height: '8px' }}></span>
                                    <span>LIVE: <strong className="font-monospace">{session.code}</strong></span>
                                </span>
                                <button className="btn btn-outline-primary btn-sm rounded-pill px-3 py-1.5" onClick={() => { fetchEmployees(); setShowInviteModal(true); }}>
                                    <i className="bi bi-person-plus me-1"></i>Invite
                                </button>
                                <button className="btn btn-danger btn-sm rounded-pill px-3 py-1.5" onClick={handleStopSession}>
                                    <i className="bi bi-stop-circle me-1"></i>End Session
                                </button>
                            </div>
                        )}

                        {/* Notifications */}
                        <div className="dropdown">
                            <button className="btn btn-light btn-sm rounded-circle p-2 border shadow-xs position-relative" type="button" data-bs-toggle="dropdown" aria-expanded="false" title="Alerts">
                                <i className="bi bi-bell text-secondary"></i>
                                {alerts.length > 0 && (
                                    <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-light rounded-circle" style={{ width: '8px', height: '8px' }}></span>
                                )}
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end shadow-sm border-0 rounded-3 mt-2" style={{ width: '280px', maxHeight: '350px', overflowY: 'auto' }}>
                                <li className="px-3 py-2 border-bottom">
                                    <span className="fw-bold small text-dark">Notifications</span>
                                    <span className="badge bg-light text-secondary border float-end">{alerts.length}</span>
                                </li>
                                {alerts.length === 0 ? (
                                    <li className="p-3 text-center text-muted small">No active notifications</li>
                                ) : (
                                    alerts.slice(0, 5).map((a, i) => (
                                        <li key={i} className="px-3 py-2 border-bottom">
                                            <div className="fw-semibold small text-dark">{a?.name || 'Participant'}</div>
                                            <div className="text-muted small text-truncate">{a?.reason || a?.message || 'Low engagement'}</div>
                                        </li>
                                    ))
                                )}
                            </ul>
                        </div>

                        {/* Profile Dropdown */}
                        <div className="dropdown">
                            <button className="btn btn-link p-0 border-0 rounded-circle shadow-xs" data-bs-toggle="dropdown" aria-expanded="false">
                                <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(managerName)}&background=4f46e5&color=fff`} alt="Profile" className="rounded-circle" width="36" height="36" />
                            </button>
                            <div className="dropdown-menu dropdown-menu-end shadow-lg border-0 rounded-4 mt-2 p-0 overflow-hidden" style={{ width: '260px' }}>
                                <div className="p-3 bg-light border-bottom text-center">
                                    <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(managerName)}&background=4f46e5&color=fff`} alt="Profile" className="rounded-circle shadow-sm mb-2" width="48" height="48" />
                                    <h6 className="fw-bold mb-0 text-dark">{managerName}</h6>
                                    <span className="badge bg-primary bg-opacity-10 text-primary small">Host</span>
                                </div>
                                <div className="p-2">
                                    <button className="dropdown-item rounded-2 py-2 small fw-medium" data-bs-toggle="modal" data-bs-target="#manageEmployeesModal">
                                        <i className="bi bi-people me-2 text-primary"></i>Manage Participants
                                    </button>
                                    <Link to="/reports" className="dropdown-item rounded-2 py-2 small fw-medium">
                                        <i className="bi bi-file-earmark-text me-2 text-info"></i>Engagement Reports
                                    </Link>
                                    <button onClick={handleLogout} className="dropdown-item rounded-2 py-2 small text-danger fw-medium">
                                        <i className="bi bi-box-arrow-right me-2"></i>Logout
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                {/* 4 Clean Metric Cards */}
                <div className="row g-3 mb-4">
                    <div className="col-sm-6 col-xl-3">
                        <div className="card glass-card border-0 shadow-sm h-100">
                            <div className="card-body p-3.5">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-muted small fw-medium text-uppercase tracking-wider">Participants</span>
                                    <span className="badge bg-primary bg-opacity-10 text-primary p-2 rounded-circle">
                                        <i className="bi bi-people-fill"></i>
                                    </span>
                                </div>
                                <h3 className="fw-bold text-dark mb-0">{uniqueEmployees}</h3>
                            </div>
                        </div>
                    </div>

                    <div className="col-sm-6 col-xl-3">
                        <div className="card glass-card border-0 shadow-sm h-100">
                            <div className="card-body p-3.5">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-muted small fw-medium text-uppercase tracking-wider">Avg Engagement</span>
                                    <span className={`badge bg-${avgEngagementColor} bg-opacity-10 text-${avgEngagementColor} p-2 rounded-circle`}>
                                        <i className="bi bi-activity"></i>
                                    </span>
                                </div>
                                <h3 className={`fw-bold text-${avgEngagementColor} mb-0`}>{avgEngagement}%</h3>
                            </div>
                        </div>
                    </div>

                    <div className="col-sm-6 col-xl-3">
                        <div className="card glass-card border-0 shadow-sm h-100">
                            <div className="card-body p-3.5">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-muted small fw-medium text-uppercase tracking-wider">Session State</span>
                                    <span className={`badge ${session.active ? 'bg-success' : 'bg-secondary'} bg-opacity-10 text-${session.active ? 'success' : 'secondary'} p-2 rounded-circle`}>
                                        <i className="bi bi-broadcast"></i>
                                    </span>
                                </div>
                                <h3 className="fw-bold text-dark mb-0 fs-4">
                                    {session.active ? (
                                        <span className="text-success d-inline-flex align-items-center gap-1">
                                            <span className="spinner-grow spinner-grow-sm text-success" role="status"></span>
                                            Active
                                        </span>
                                    ) : (
                                        <span className="text-muted">Idle</span>
                                    )}
                                </h3>
                            </div>
                        </div>
                    </div>

                    <div className="col-sm-6 col-xl-3">
                        <div className="card glass-card border-0 shadow-sm h-100">
                            <div className="card-body p-3.5">
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                    <span className="text-muted small fw-medium text-uppercase tracking-wider">Alerts</span>
                                    <span className={`badge ${alerts.length > 0 ? 'bg-danger text-danger' : 'bg-success text-success'} bg-opacity-10 p-2 rounded-circle`}>
                                        <i className={`bi ${alerts.length > 0 ? 'bi-exclamation-triangle-fill' : 'bi-shield-check'}`}></i>
                                    </span>
                                </div>
                                <h3 className={`fw-bold mb-0 ${alerts.length > 0 ? 'text-danger' : 'text-success'}`}>{alerts.length}</h3>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main 2-Column Section */}
                <div className="row g-4 mb-4">
                    {/* Left: Engagement Table */}
                    <div className="col-lg-8">
                        <div className="card glass-card border-0 shadow-sm h-100">
                            <div className="card-header bg-transparent border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                                <div>
                                    <h5 className="fw-bold mb-0 text-dark">
                                        {session.active ? "Live Participant Stream" : "Session Engagement"}
                                    </h5>
                                </div>
                                <Link to="/reports" className="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-xs">
                                    View Reports
                                </Link>
                            </div>

                            <div className="card-body p-0">
                                <div className="table-responsive">
                                    <table className="table table-hover align-middle mb-0">
                                        <thead className="bg-light bg-opacity-50 text-nowrap">
                                            <tr>
                                                <th scope="col" className="ps-4 text-muted small fw-semibold">Participant</th>
                                                <th scope="col" className="text-muted small fw-semibold">Session</th>
                                                <th scope="col" className="text-muted small fw-semibold">Duration</th>
                                                <th scope="col" className="text-muted small fw-semibold pe-4">Score</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {loading && data.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-5 text-muted">
                                                        <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                                        Loading records...
                                                    </td>
                                                </tr>
                                            ) : data.length === 0 ? (
                                                <tr>
                                                    <td colSpan="4" className="text-center py-5 text-muted">
                                                        <i className="bi bi-inbox fs-2 d-block text-secondary opacity-50 mb-2"></i>
                                                        <span className="fw-medium">No records available</span>
                                                        <p className="small text-muted mb-0">Start a session to monitor participant engagement.</p>
                                                    </td>
                                                </tr>
                                            ) : session.active ? (
                                                data.map((emp, i) => {
                                                    const score = getEmpScore(emp);
                                                    const scoreColor = score > 75 ? 'success' : (score >= 50 ? 'warning' : 'danger');
                                                    const durSec = getEmpDuration(emp);

                                                    return (
                                                        <tr key={i}>
                                                            <td className="ps-4 fw-medium text-dark">{emp.name || 'Participant'}</td>
                                                            <td><span className="badge bg-light text-secondary border font-monospace">{emp.sessionCode || session.code || '-'}</span></td>
                                                            <td className="text-secondary small">{formatDuration(durSec)}</td>
                                                            <td className="pe-4">
                                                                <div className="d-flex align-items-center gap-2">
                                                                    <div className="progress flex-grow-1" style={{ height: '6px', backgroundColor: '#e2e8f0' }}>
                                                                        <div className={`progress-bar bg-${scoreColor}`} role="progressbar" style={{ width: `${Math.min(100, Math.max(0, score))}%` }}></div>
                                                                    </div>
                                                                    <span className={`fw-bold text-${scoreColor} small`} style={{ minWidth: '38px' }}>{score}%</span>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            ) : (
                                                historicalGroups.map((group, i) => {
                                                    const avgScore = Math.round(group.totalScore / group.sessions.length);
                                                    const scoreColor = avgScore > 75 ? 'success' : (avgScore >= 50 ? 'warning' : 'danger');
                                                    const durSec = group.totalDuration;
                                                    const isExpanded = expandedRows[group.name];

                                                    return (
                                                        <React.Fragment key={`group-${i}`}>
                                                            <tr className="bg-light bg-opacity-50" style={{ cursor: 'pointer' }} onClick={() => toggleRow(group.name)}>
                                                                <td className="ps-4 fw-semibold text-dark">
                                                                    <div className="d-flex align-items-center">
                                                                        <i className={`bi bi-chevron-${isExpanded ? 'up' : 'down'} me-2 text-primary small`}></i>
                                                                        <span>{group.name}</span>
                                                                        <span className="badge bg-white text-secondary border ms-2 small fw-normal">
                                                                            {group.sessions.length} {group.sessions.length === 1 ? 'session' : 'sessions'}
                                                                        </span>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    <span className="badge bg-light text-secondary border font-monospace">
                                                                        {group.lastSessionCode || '-'}
                                                                    </span>
                                                                </td>
                                                                <td className="text-secondary small">{formatDuration(durSec)}</td>
                                                                <td className="pe-4">
                                                                    <div className="d-flex align-items-center gap-2">
                                                                        <div className="progress flex-grow-1" style={{ height: '6px', backgroundColor: '#e2e8f0' }}>
                                                                            <div className={`progress-bar bg-${scoreColor}`} role="progressbar" style={{ width: `${Math.min(100, Math.max(0, avgScore))}%` }}></div>
                                                                        </div>
                                                                        <span className={`fw-bold text-${scoreColor} small`} style={{ minWidth: '38px' }}>{avgScore}%</span>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                            {isExpanded && group.sessions.map((emp, j) => {
                                                                const score = getEmpScore(emp);
                                                                const sColor = score > 75 ? 'success' : (score >= 50 ? 'warning' : 'danger');
                                                                const empDur = getEmpDuration(emp);
                                                                const sessionDate = (emp.joinTime || emp.timestamp) ? new Date(emp.joinTime || emp.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }) : null;

                                                                return (
                                                                    <tr key={`sub-${i}-${j}`} style={{ backgroundColor: '#f8fafc' }}>
                                                                        <td className="ps-5">
                                                                            <div className="d-flex align-items-center">
                                                                                <i className="bi bi-arrow-return-right text-muted me-2 small"></i>
                                                                                <span className="badge bg-white text-dark border px-2 py-0.5 rounded-pill fw-semibold me-2 shadow-xs">
                                                                                    Session {j + 1}
                                                                                </span>
                                                                                {sessionDate && (
                                                                                    <span className="text-muted small">({sessionDate})</span>
                                                                                )}
                                                                            </div>
                                                                        </td>
                                                                        <td>
                                                                            <span className="badge bg-white text-secondary border font-monospace px-2 py-0.5">
                                                                                {emp.sessionCode || '-'}
                                                                            </span>
                                                                        </td>
                                                                        <td className="text-secondary small">{formatDuration(empDur)}</td>
                                                                        <td className="pe-4">
                                                                            <div className="d-flex align-items-center gap-2">
                                                                                <div className="progress flex-grow-1" style={{ height: '5px', backgroundColor: '#e2e8f0' }}>
                                                                                    <div className={`progress-bar bg-${sColor}`} role="progressbar" style={{ width: `${Math.min(100, Math.max(0, score))}%` }}></div>
                                                                                </div>
                                                                                <span className={`fw-bold text-${sColor} small`} style={{ minWidth: '38px' }}>{score}%</span>
                                                                            </div>
                                                                        </td>
                                                                    </tr>
                                                                );
                                                            })}
                                                        </React.Fragment>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Recent Alerts */}
                    <div className="col-lg-4">
                        <div className="card glass-card border-0 shadow-sm h-100">
                            <div className="card-header bg-transparent border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                                <h5 className="fw-bold mb-0 text-dark">Recent Alerts</h5>
                                <span className={`badge ${alerts.length > 0 ? 'bg-danger' : 'bg-success'} rounded-pill`}>
                                    {alerts.length}
                                </span>
                            </div>

                            <div className="card-body p-3">
                                {alerts.length === 0 ? (
                                    <div className="text-center py-5">
                                        <i className="bi bi-shield-check text-success fs-1 mb-2 d-block"></i>
                                        <h6 className="fw-semibold text-dark mb-1">All Clear</h6>
                                        <p className="text-muted small mb-0">No low engagement or security alerts recorded.</p>
                                    </div>
                                ) : (
                                    <div className="d-flex flex-column gap-2">
                                        {alerts.slice(0, 5).map((alert, i) => (
                                            <div key={i} className="p-3 rounded-3 bg-light border-start border-3 border-danger d-flex justify-content-between align-items-start">
                                                <div>
                                                    <strong className="text-dark small d-block">{alert.name || 'Participant'}</strong>
                                                    <span className="text-muted small">{alert.message || alert.reason || 'Low engagement score'}</span>
                                                </div>
                                                <span className="badge bg-danger bg-opacity-10 text-danger small">Alert</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="card-footer bg-transparent border-top py-3 text-center">
                                <Link to="/alerts" className="text-decoration-none text-primary small fw-semibold d-inline-flex align-items-center gap-1">
                                    <span>View All Alerts</span>
                                    <i className="bi bi-arrow-right"></i>
                                </Link>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom: Performance Highlights Bar */}
                <div className="card glass-card border-0 shadow-sm mb-4">
                    <div className="card-body p-4">
                        <div className="row g-3 text-center">
                            <div className="col-6 col-md-3 border-end">
                                <span className="text-muted small text-uppercase fw-semibold d-block mb-1">Participants</span>
                                <h4 className="fw-bold text-dark mb-0">{uniqueEmployees}</h4>
                            </div>
                            <div className="col-6 col-md-3 border-end">
                                <span className="text-muted small text-uppercase fw-semibold d-block mb-1">Top Focus</span>
                                <h4 className="fw-bold text-success mb-0">{mostEngaged}</h4>
                            </div>
                            <div className="col-6 col-md-3 border-end">
                                <span className="text-muted small text-uppercase fw-semibold d-block mb-1">Needs Review</span>
                                <h4 className="fw-bold text-danger mb-0">{mostDistracted}</h4>
                            </div>
                            <div className="col-6 col-md-3">
                                <span className="text-muted small text-uppercase fw-semibold d-block mb-1">Avg Session Time</span>
                                <h4 className="fw-bold text-primary mb-0">{avgDurationMinutes}m</h4>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Manage Employees Modal */}
            <div className="modal fade" id="manageEmployeesModal" tabIndex="-1" aria-hidden="true">
                <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                    <div className="modal-content bg-white border-0 shadow rounded-4 overflow-hidden">
                        <div className="modal-header border-bottom px-4 py-3">
                            <h5 className="modal-title fw-bold text-dark"><i className="bi bi-people me-2 text-primary"></i>Workspace Participants</h5>
                            <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div className="modal-body p-0">
                            <div className="table-responsive">
                                <table className="table table-hover align-middle mb-0">
                                    <thead className="bg-light">
                                        <tr>
                                            <th className="ps-4">Name</th>
                                            <th>Email</th>
                                            <th>ID</th>
                                            <th className="text-end pe-4">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {employees.length === 0 ? (
                                            <tr>
                                                <td colSpan="4" className="text-center py-4 text-muted">No participants registered yet.</td>
                                            </tr>
                                        ) : (
                                            employees.map(emp => (
                                                <tr key={emp.id}>
                                                    <td className="ps-4 fw-medium text-dark">{emp.name}</td>
                                                    <td className="text-muted">{emp.email}</td>
                                                    <td className="text-muted small">#{emp.id}</td>
                                                    <td className="text-end pe-4">
                                                        <button className="btn btn-sm btn-outline-danger rounded-pill px-3 shadow-xs" onClick={() => removeEmployee(emp.id)}>
                                                            <i className="bi bi-person-x me-1"></i>Remove
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="modal-footer border-top bg-light px-4 py-2">
                            <button className="btn btn-sm btn-secondary rounded-pill px-4" data-bs-dismiss="modal">Close</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Invite Employees Modal */}
            {showInviteModal && (
                <div className="modal fade show d-block" tabIndex="-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
                    <div className="modal-dialog modal-dialog-centered">
                        <div className="modal-content bg-white border-0 shadow rounded-4 overflow-hidden">
                            <div className="modal-header border-bottom px-4 py-3">
                                <h5 className="modal-title fw-bold text-dark"><i className="bi bi-envelope me-2 text-primary"></i>Invite to Active Session</h5>
                                <button type="button" className="btn-close" onClick={() => setShowInviteModal(false)}></button>
                            </div>
                            <div className="modal-body px-4 py-3">
                                <div className="d-flex justify-content-between align-items-center mb-3">
                                    <span className="small text-muted fw-semibold">Select participants:</span>
                                    <div className="form-check">
                                        <input className="form-check-input" type="checkbox" id="selectAll"
                                            checked={selectedEmployees.size === employees.length && employees.length > 0}
                                            onChange={(e) => {
                                                if (e.target.checked) {
                                                    setSelectedEmployees(new Set(employees.map(emp => emp.id)));
                                                } else {
                                                    setSelectedEmployees(new Set());
                                                }
                                            }}
                                        />
                                        <label className="form-check-label small" htmlFor="selectAll">Select All</label>
                                    </div>
                                </div>
                                <div className="list-group rounded-3 border" style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                    {employees.length === 0 ? (
                                        <div className="text-center text-muted p-3 small">No participants found.</div>
                                    ) : (
                                        employees.map(emp => (
                                            <label key={emp.id} className="list-group-item d-flex align-items-center gap-3 border-0 border-bottom" style={{ cursor: 'pointer' }}>
                                                <input className="form-check-input flex-shrink-0" type="checkbox"
                                                    checked={selectedEmployees.has(emp.id)}
                                                    onChange={(e) => {
                                                        const newSet = new Set(selectedEmployees);
                                                        if (e.target.checked) newSet.add(emp.id);
                                                        else newSet.delete(emp.id);
                                                        setSelectedEmployees(newSet);
                                                    }}
                                                />
                                                <div>
                                                    <div className="fw-semibold text-dark small">{emp.name}</div>
                                                    <div className="text-muted small" style={{ fontSize: '0.75rem' }}>{emp.email}</div>
                                                </div>
                                            </label>
                                        ))
                                    )}
                                </div>
                            </div>
                            <div className="modal-footer border-top px-4 py-2">
                                <button className="btn btn-sm btn-secondary rounded-pill px-3" onClick={() => setShowInviteModal(false)}>Cancel</button>
                                <button className="btn btn-sm btn-primary rounded-pill px-4" onClick={async () => {
                                    if (selectedEmployees.size === 0) {
                                        alert("Please select at least one participant.");
                                        return;
                                    }
                                    try {
                                        const res = await api.post('/send-invites', {
                                            sessionCode: session.code,
                                            userIds: Array.from(selectedEmployees)
                                        });
                                        if (res.success) {
                                            setShowInviteModal(false);
                                            setSelectedEmployees(new Set());
                                        } else {
                                            alert("Failed to send invites.");
                                        }
                                    } catch (e) {
                                        alert("Error sending invites.");
                                    }
                                }}>Send Invites</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
