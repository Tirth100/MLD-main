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

    // Idea 2: Team Focus Distribution calculations
    const activeParticipantsList = session.active
        ? data
        : historicalGroups.map(g => ({
            name: g.name,
            score: Math.round(g.totalScore / g.sessions.length),
            duration: g.totalDuration,
            sessionCode: g.lastSessionCode,
            sessionsCount: g.sessions.length
        }));

    const totalMembers = activeParticipantsList.length;
    const engagedList = activeParticipantsList.filter(p => getEmpScore(p) > 75);
    const focusedList = activeParticipantsList.filter(p => {
        const s = getEmpScore(p);
        return s >= 50 && s <= 75;
    });
    const lowList = activeParticipantsList.filter(p => getEmpScore(p) < 50);

    const engagedPct = totalMembers > 0 ? Math.round((engagedList.length / totalMembers) * 100) : 0;
    const focusedPct = totalMembers > 0 ? Math.round((focusedList.length / totalMembers) * 100) : 0;
    const lowPct = totalMembers > 0 ? Math.max(0, 100 - engagedPct - focusedPct) : 0;

    return (
        <>
            <Sidebar />

            <main className="main-content">
                {/* Header Navbar */}
                <header className="top-navbar rounded-4 glass-card mb-4 border-0 shadow-sm py-3 px-4">
                    <div className="d-flex align-items-center gap-3">
                        <div>
                            <h4 className="fw-bold mb-0 text-dark">Overview</h4>
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
                    {/* Left: Team Focus Distribution Gauge & Highlights (Idea 2) */}
                    <div className="col-lg-8">
                        <div className="card glass-card border-0 shadow-sm h-100">
                            <div className="card-header bg-transparent border-bottom py-3 px-4 d-flex justify-content-between align-items-center">
                                <div>
                                    <h5 className="fw-bold mb-0 text-dark">
                                        {session.active ? "Live Focus Distribution" : "Team Focus Distribution"}
                                    </h5>
                                    <small className="text-muted">Real-time attention & engagement breakdown</small>
                                </div>
                                <Link to="/reports" className="btn btn-sm btn-outline-primary rounded-pill px-3 shadow-xs">
                                    View Reports
                                </Link>
                            </div>

                            <div className="card-body p-4">
                                {totalMembers === 0 ? (
                                    <div className="text-center py-5 text-muted">
                                        <i className="bi bi-pie-chart fs-1 d-block text-secondary opacity-50 mb-2"></i>
                                        <span className="fw-semibold text-dark">No Engagement Data</span>
                                        <p className="small text-muted mb-0">Start a session to monitor participant engagement.</p>
                                    </div>
                                ) : (
                                    <>
                                        {/* Multi-segment Distribution Bar */}
                                        <div className="mb-4">
                                            <div className="d-flex justify-content-between align-items-center mb-2">
                                                <span className="small text-muted fw-semibold text-uppercase tracking-wider">Overall Focus</span>
                                                <span className="small text-dark fw-bold">{totalMembers} {totalMembers === 1 ? 'Participant' : 'Participants'}</span>
                                            </div>
                                            <div className="progress rounded-pill shadow-xs" style={{ height: '14px', backgroundColor: '#e2e8f0', overflow: 'hidden' }}>
                                                {engagedPct > 0 && (
                                                    <div className="progress-bar bg-success" style={{ width: `${engagedPct}%` }} title={`Engaged: ${engagedList.length} (${engagedPct}%)`}></div>
                                                )}
                                                {focusedPct > 0 && (
                                                    <div className="progress-bar bg-warning" style={{ width: `${focusedPct}%` }} title={`Focused: ${focusedList.length} (${focusedPct}%)`}></div>
                                                )}
                                                {lowPct > 0 && (
                                                    <div className="progress-bar bg-danger" style={{ width: `${lowPct}%` }} title={`Low Engagement: ${lowList.length} (${lowPct}%)`}></div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 3 Tier Summary Cards */}
                                        <div className="row g-3 mb-4">
                                            <div className="col-4">
                                                <div className="p-3 rounded-3 border bg-success bg-opacity-10 text-center">
                                                    <div className="d-flex align-items-center justify-content-center gap-1 mb-1">
                                                        <span className="rounded-circle bg-success d-inline-block" style={{ width: '8px', height: '8px' }}></span>
                                                        <span className="small fw-semibold text-success">Engaged</span>
                                                    </div>
                                                    <h4 className="fw-bold text-success mb-0">{`${engagedPct}%`}</h4>
                                                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>{engagedList.length} {engagedList.length === 1 ? 'member' : 'members'}</small>
                                                </div>
                                            </div>

                                            <div className="col-4">
                                                <div className="p-3 rounded-3 border bg-warning bg-opacity-10 text-center">
                                                    <div className="d-flex align-items-center justify-content-center gap-1 mb-1">
                                                        <span className="rounded-circle bg-warning d-inline-block" style={{ width: '8px', height: '8px' }}></span>
                                                        <span className="small fw-semibold text-warning">Focused</span>
                                                    </div>
                                                    <h4 className="fw-bold text-warning mb-0">{`${focusedPct}%`}</h4>
                                                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>{focusedList.length} {focusedList.length === 1 ? 'member' : 'members'}</small>
                                                </div>
                                            </div>

                                            <div className="col-4">
                                                <div className="p-3 rounded-3 border bg-danger bg-opacity-10 text-center">
                                                    <div className="d-flex align-items-center justify-content-center gap-1 mb-1">
                                                        <span className="rounded-circle bg-danger d-inline-block" style={{ width: '8px', height: '8px' }}></span>
                                                        <span className="small fw-semibold text-danger">Low Focus</span>
                                                    </div>
                                                    <h4 className="fw-bold text-danger mb-0">{`${lowPct}%`}</h4>
                                                    <small className="text-muted" style={{ fontSize: '0.75rem' }}>{lowList.length} {lowList.length === 1 ? 'member' : 'members'}</small>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Participant Breakdown Cards */}
                                        <div className="border-top pt-3">
                                            <div className="d-flex justify-content-between align-items-center mb-3">
                                                <span className="small text-muted fw-semibold text-uppercase tracking-wider">Participant Breakdown</span>
                                                <span className="small text-muted">{activeParticipantsList.length} Total</span>
                                            </div>
                                            <div className="d-flex flex-column gap-2">
                                                {activeParticipantsList.map((p, idx) => {
                                                    const s = getEmpScore(p);
                                                    const tierColor = s > 75 ? 'success' : (s >= 50 ? 'warning' : 'danger');
                                                    const tierName = s > 75 ? 'Engaged' : (s >= 50 ? 'Focused' : 'Low Engagement');
                                                    const dur = p.duration ? formatDuration(p.duration) : (p.totalDuration ? formatDuration(p.totalDuration) : '-');

                                                    return (
                                                        <div key={idx} className="p-3 rounded-3 bg-light bg-opacity-75 border d-flex align-items-center justify-content-between flex-wrap gap-2">
                                                            <div className="d-flex align-items-center gap-3">
                                                                <img
                                                                    src={`https://ui-avatars.com/api/?name=${encodeURIComponent(p.name || 'User')}&background=4f46e5&color=fff&bold=true`}
                                                                    width="34"
                                                                    height="34"
                                                                    className="rounded-circle shadow-xs"
                                                                    alt={p.name}
                                                                />
                                                                <div>
                                                                    <div className="fw-semibold text-dark small">{p.name || 'Participant'}</div>
                                                                    <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                                                                        {p.sessionsCount ? `${p.sessionsCount} ${p.sessionsCount === 1 ? 'session' : 'sessions'} • ` : ''}Duration: {dur}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <div className="d-flex align-items-center gap-3">
                                                                <div style={{ width: '100px' }}>
                                                                    <div className="progress" style={{ height: '6px', backgroundColor: '#e2e8f0' }}>
                                                                        <div className={`progress-bar bg-${tierColor}`} style={{ width: `${Math.min(100, Math.max(0, s))}%` }}></div>
                                                                    </div>
                                                                </div>
                                                                <span className={`badge bg-${tierColor} bg-opacity-10 text-${tierColor} px-2.5 py-1 rounded-pill fw-semibold small`}>
                                                                    {s}% • {tierName}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </>
                                )}
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
