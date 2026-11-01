import { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import Sidebar from '../components/Sidebar';
import { Activity, Clock, Layers, AlertTriangle, RefreshCw } from 'lucide-react';
import { api } from '../api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler);

function formatDuration(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return '0m';
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function formatTotalHours(sec) {
  if (!sec || isNaN(sec) || sec <= 0) return '0h';
  const hours = (sec / 3600).toFixed(1);
  return `${hours}h`;
}

export default function Analytics() {
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnalyticsData = async () => {
    try {
      const [engRes, alertRes] = await Promise.all([
        api.get('/engagement'),
        api.get('/alerts')
      ]);

      if (Array.isArray(engRes)) {
        setReports(engRes);
      } else {
        setReports([]);
      }

      if (Array.isArray(alertRes)) {
        setAlerts(alertRes);
      } else {
        setAlerts([]);
      }
    } catch (err) {
      console.error("Failed to load analytics data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    const interval = setInterval(fetchAnalyticsData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Compute live real metrics from database reports
  const totalReports = reports.length;
  const avgEngagement = totalReports > 0
    ? Math.round(reports.reduce((acc, r) => acc + (Number(r.score) || 0), 0) / totalReports)
    : 0;

  const totalTrackedSeconds = reports.reduce((acc, r) => {
    const sec = r.durationSeconds !== undefined ? Number(r.durationSeconds) : (Number(r.totalChecks) * 5 || 0);
    return acc + (isNaN(sec) ? 0 : sec);
  }, 0);

  const uniqueSessions = Array.from(new Set(reports.map(r => r.sessionCode).filter(Boolean)));
  const totalSessionsCount = uniqueSessions.length;

  // Real Distraction / Leech Alerts count
  const leechReportsCount = reports.filter(r => (Number(r.score) || 0) < 50).length;
  const alertCount = Math.max(leechReportsCount, alerts.length);

  // Focus Distribution (Doughnut Chart Data)
  const engagedCount = reports.filter(r => (Number(r.score) || 0) >= 75).length;
  const focusedCount = reports.filter(r => (Number(r.score) || 0) >= 50 && (Number(r.score) || 0) < 75).length;
  const disengagedCount = reports.filter(r => (Number(r.score) || 0) < 50).length;

  const doughnutData = {
    labels: ['Engaged (≥75%)', 'Focused (50-74%)', 'Low Focus / Leech (<50%)'],
    datasets: [{
      data: totalReports > 0 ? [engagedCount, focusedCount, disengagedCount] : [1, 0, 0],
      backgroundColor: totalReports > 0 ? ['#10b981', '#3b82f6', '#ef4444'] : ['#e2e8f0', '#e2e8f0', '#e2e8f0'],
      borderWidth: 2,
      borderColor: '#ffffff'
    }]
  };

  // Session-by-Session Historical Trend (Line Chart)
  // Group reports by sessionCode to compute true average per session
  const sessionStatsMap = {};
  // Process in chronological order (reverse of DESC)
  const reversedReports = [...reports].reverse();
  reversedReports.forEach(r => {
    const code = r.sessionCode || 'General';
    if (!sessionStatsMap[code]) {
      sessionStatsMap[code] = { scores: [], date: r.timestamp || '' };
    }
    sessionStatsMap[code].scores.push(Number(r.score) || 0);
  });

  const sessionLabels = Object.keys(sessionStatsMap).slice(-10); // Last 10 sessions
  const sessionAverages = sessionLabels.map(code => {
    const scores = sessionStatsMap[code].scores;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });

  const lineChartData = {
    labels: sessionLabels.length > 0 ? sessionLabels : ['No Sessions Yet'],
    datasets: [{
      label: 'Session Avg Engagement (%)',
      data: sessionAverages.length > 0 ? sessionAverages : [0],
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.12)',
      fill: true,
      tension: 0.35,
      pointRadius: 5,
      pointBackgroundColor: '#2563eb'
    }]
  };

  // Participant Score Comparison (Bar Chart)
  const employeeScoreMap = {};
  reports.forEach(r => {
    const name = r.name || 'Anonymous';
    if (!employeeScoreMap[name]) {
      employeeScoreMap[name] = [];
    }
    employeeScoreMap[name].push(Number(r.score) || 0);
  });

  const participantNames = Object.keys(employeeScoreMap).slice(0, 6);
  const participantAvgScores = participantNames.map(name => {
    const scores = employeeScoreMap[name];
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });

  const barChartData = {
    labels: participantNames.length > 0 ? participantNames : ['No Participants'],
    datasets: [{
      label: 'Avg Engagement Score (%)',
      data: participantAvgScores.length > 0 ? participantAvgScores : [0],
      backgroundColor: participantAvgScores.map(score => score >= 75 ? '#10b981' : score >= 50 ? '#3b82f6' : '#ef4444'),
      borderRadius: 6
    }]
  };

  if (loading) {
    return (
      <>
        <Sidebar />
        <main className="main-content d-flex justify-content-center align-items-center" style={{ minHeight: '80vh' }}>
          <div className="text-center">
            <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status"></div>
            <p className="text-muted fw-semibold">Loading live workspace analytics...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <header className="top-navbar mb-4 rounded-3 glass-card d-flex justify-content-between align-items-center">
          <div className="d-flex align-items-center">
            <h4 className="mb-0 fw-bold">Live Workspace Analytics</h4>
            <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 ms-3 px-3 py-2 rounded-pill">
              <span className="spinner-grow spinner-grow-sm me-1" style={{ width: '0.5rem', height: '0.5rem' }}></span>
              Live Data
            </span>
          </div>
          <button 
            className="btn btn-outline-secondary btn-sm rounded-pill px-3 d-flex align-items-center"
            onClick={() => { setRefreshing(true); fetchAnalyticsData(); }}
            disabled={refreshing}
          >
            <RefreshCw size={14} className={`me-1 ${refreshing ? 'spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </header>

        {/* Real Live KPI Cards */}
        <div className="row g-4 mb-4">
          <div className="col-md-3">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-body d-flex align-items-center">
                <div className="bg-primary bg-opacity-10 p-3 rounded-circle me-3">
                  <Activity className="text-primary" size={24} />
                </div>
                <div>
                  <h6 className="text-muted mb-1 small">Avg Engagement</h6>
                  <h3 className={`mb-0 fw-bold ${avgEngagement >= 75 ? 'text-success' : avgEngagement >= 50 ? 'text-primary' : 'text-danger'}`}>
                    {avgEngagement}%
                  </h3>
                  <small className="text-muted">{totalReports} total participant logs</small>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-body d-flex align-items-center">
                <div className="bg-success bg-opacity-10 p-3 rounded-circle me-3">
                  <Clock className="text-success" size={24} />
                </div>
                <div>
                  <h6 className="text-muted mb-1 small">Total Tracked Time</h6>
                  <h3 className="mb-0 fw-bold text-dark">{formatTotalHours(totalTrackedSeconds)}</h3>
                  <small className="text-muted">{formatDuration(totalTrackedSeconds)} recorded</small>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-body d-flex align-items-center">
                <div className="bg-info bg-opacity-10 p-3 rounded-circle me-3">
                  <Layers className="text-info" size={24} />
                </div>
                <div>
                  <h6 className="text-muted mb-1 small">Monitored Meetings</h6>
                  <h3 className="mb-0 fw-bold text-dark">{totalSessionsCount}</h3>
                  <small className="text-muted">{uniqueSessions.slice(0, 2).join(', ') || 'No sessions yet'}</small>
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-3">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-body d-flex align-items-center">
                <div className="bg-danger bg-opacity-10 p-3 rounded-circle me-3">
                  <AlertTriangle className="text-danger" size={24} />
                </div>
                <div>
                  <h6 className="text-muted mb-1 small">Distraction / Leech Alerts</h6>
                  <h3 className="mb-0 fw-bold text-danger">{alertCount}</h3>
                  <small className="text-muted">Scores &lt; 50% threshold</small>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Live Analytical Charts */}
        <div className="row g-4 mb-4">
          {/* Trend Chart across Sessions */}
          <div className="col-md-8">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-0 d-flex justify-content-between align-items-center">
                <h6 className="fw-bold mb-0">Meeting-by-Meeting Engagement Trend</h6>
                <small className="text-muted">Historical session averages</small>
              </div>
              <div className="card-body" style={{ height: '300px', position: 'relative' }}>
                <Line 
                  data={lineChartData} 
                  options={{ 
                    maintainAspectRatio: false, 
                    plugins: { 
                      legend: { display: false },
                      tooltip: {
                        callbacks: {
                          label: (ctx) => `Avg Score: ${ctx.parsed.y}%`
                        }
                      }
                    },
                    scales: { 
                      y: { 
                        min: 0, 
                        max: 100,
                        ticks: { stepSize: 20, callback: (v) => `${v}%` }
                      },
                      x: { grid: { display: false } }
                    }
                  }} 
                />
              </div>
            </div>
          </div>

          {/* Focus Tier Breakdown Doughnut */}
          <div className="col-md-4">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-0">
                <h6 className="fw-bold mb-0">Participant Focus Breakdown</h6>
              </div>
              <div className="card-body d-flex flex-column justify-content-center align-items-center" style={{ height: '300px', position: 'relative' }}>
                <div style={{ width: '200px', height: '200px' }}>
                  <Doughnut 
                    data={doughnutData} 
                    options={{ 
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } }
                      },
                      cutout: '68%'
                    }} 
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Participant Ranking Bar Chart */}
        <div className="card glass-card border-0 shadow-sm mb-4">
          <div className="card-header bg-transparent border-bottom-0 pt-4 pb-0 d-flex justify-content-between align-items-center">
            <h6 className="fw-bold mb-0">Participant Average Engagement Ranking</h6>
            <small className="text-muted">Computed from actual meeting records</small>
          </div>
          <div className="card-body" style={{ height: '260px', position: 'relative' }}>
            <Bar 
              data={barChartData} 
              options={{ 
                maintainAspectRatio: false, 
                plugins: { 
                  legend: { display: false },
                  tooltip: {
                    callbacks: {
                      label: (ctx) => `Avg Score: ${ctx.parsed.y}%`
                    }
                  }
                },
                scales: { 
                  y: { min: 0, max: 100, ticks: { stepSize: 25, callback: (v) => `${v}%` } },
                  x: { grid: { display: false } }
                }
              }} 
            />
          </div>
        </div>

        {/* Deep-Dive Post-Session Reports Table (Real Records) */}
        <div className="card glass-card border-0 shadow-sm mb-4">
          <div className="card-header bg-transparent border-bottom pt-4 pb-3 d-flex justify-content-between align-items-center">
            <h6 className="fw-bold mb-0">Recent Post-Session Meeting Records</h6>
            <span className="badge bg-light text-muted border">{reports.length} Records</span>
          </div>
          <div className="card-body p-0">
            {reports.length === 0 ? (
              <div className="p-5 text-center text-muted">
                <Activity size={36} className="text-muted mb-2 opacity-50" />
                <h6 className="fw-semibold">No meeting records found yet</h6>
                <p className="small mb-0">Conduct a session with your participants to see detailed telemetry here.</p>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-hover align-middle mb-0">
                  <thead className="bg-light">
                    <tr>
                      <th className="ps-4 text-muted small fw-medium">Participant</th>
                      <th className="text-muted small fw-medium">Session Code</th>
                      <th className="text-muted small fw-medium">Date & Time</th>
                      <th className="text-muted small fw-medium">Session Duration</th>
                      <th className="text-muted small fw-medium">Engagement Score</th>
                      <th className="text-muted small fw-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.slice(0, 10).map((r, idx) => {
                      const score = Number(r.score) || 0;
                      const durSec = r.durationSeconds !== undefined ? Number(r.durationSeconds) : (Number(r.totalChecks) * 5 || 0);
                      const isLeech = score < 50;
                      const status = r.status || (score >= 75 ? 'Engaged' : score >= 50 ? 'Focused' : 'Low Engagement');

                      return (
                        <tr key={r.id || idx}>
                          <td className="ps-4 fw-medium text-dark">{r.name || 'Anonymous User'}</td>
                          <td>
                            <span className="badge bg-light text-primary border px-2 py-1 tracking-widest font-monospace">
                              {r.sessionCode || 'General'}
                            </span>
                          </td>
                          <td className="text-muted small">{r.timestamp || 'Recent'}</td>
                          <td>{formatDuration(durSec)}</td>
                          <td style={{ width: '200px' }}>
                            <div className="d-flex align-items-center">
                              <span className={`fw-bold me-2 small ${score >= 75 ? 'text-success' : score >= 50 ? 'text-primary' : 'text-danger'}`}>
                                {score}%
                              </span>
                              <div className="progress flex-grow-1" style={{ height: '6px' }}>
                                <div 
                                  className={`progress-bar ${score >= 75 ? 'bg-success' : score >= 50 ? 'bg-primary' : 'bg-danger'}`} 
                                  style={{ width: `${score}%` }}
                                ></div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={`badge px-2 py-1 rounded-pill ${isLeech ? 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25' : score >= 75 ? 'bg-success bg-opacity-10 text-success' : 'bg-primary bg-opacity-10 text-primary'}`}>
                              {status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
