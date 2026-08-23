import { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import Sidebar from '../components/Sidebar';
import { Activity, Clock, Users, AlertTriangle } from 'lucide-react';
import { api } from '../api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler);

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Generate mock historical data for the new dashboard since we are moving away from realtime
  const generateMockData = () => {
    // 30 days of engagement scores
    const days = Array.from({length: 30}, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    const engagementTrend = Array.from({length: 30}, () => Math.floor(Math.random() * 30) + 70); // 70-100%

    return {
      kpis: {
        avgEngagement: "87%",
        totalHours: "1,240h",
        topDept: "Engineering",
        alerts: 12
      },
      trend: {
        labels: days,
        data: engagementTrend
      },
      departmentComparison: {
        labels: ['Engineering', 'Design', 'Marketing', 'Sales', 'HR'],
        data: [92, 85, 78, 88, 81]
      },
      recentSessions: [
        { id: 1, name: "Jal", role: "Developer", duration: "2h 15m", score: 94, date: "Today, 10:30 AM" },
        { id: 2, name: "DEV", role: "Designer", duration: "1h 45m", score: 82, date: "Today, 09:15 AM" },
        { id: 3, name: "Tirth", role: "Manager", duration: "3h 20m", score: 88, date: "Yesterday, 02:00 PM" },
        { id: 4, name: "PAWANESH", role: "Developer", duration: "4h 00m", score: 71, date: "Yesterday, 11:00 AM" },
      ]
    };
  };

  useEffect(() => {
    // Simulate fetching historical data
    setTimeout(() => {
      setData(generateMockData());
      setLoading(false);
    }, 800);
  }, []);

  if (loading || !data) {
    return (
      <>
        <Sidebar />
        <main className="main-content d-flex justify-content-center align-items-center">
          <div className="spinner-border text-primary" role="status"></div>
        </main>
      </>
    );
  }

  const lineData = {
    labels: data.trend.labels,
    datasets: [{
      label: 'Average Engagement (%)',
      data: data.trend.data,
      borderColor: '#3b82f6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };

  const barData = {
    labels: data.departmentComparison.labels,
    datasets: [{
      label: 'Avg Score',
      data: data.departmentComparison.data,
      backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'],
      borderRadius: 6
    }]
  };

  return (
    <>
      <Sidebar />
      <main className="main-content">
        <header className="top-navbar mb-4 rounded-3 glass-card">
          <div className="d-flex align-items-center">
            <h4 className="mb-0 fw-bold">Historical Analytics Dashboard</h4>
          </div>
        </header>

        {/* Managerial Overview - KPIs */}
        <div className="row g-4 mb-4">
          <div className="col-md-3">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-body d-flex align-items-center">
                <div className="bg-primary bg-opacity-10 p-3 rounded-circle me-3">
                  <Activity className="text-primary" size={24} />
                </div>
                <div>
                  <h6 className="text-muted mb-1 small">Avg Engagement (30d)</h6>
                  <h3 className="mb-0 fw-bold">{data.kpis.avgEngagement}</h3>
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
                  <h6 className="text-muted mb-1 small">Total Tracked Hours</h6>
                  <h3 className="mb-0 fw-bold">{data.kpis.totalHours}</h3>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-3">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-body d-flex align-items-center">
                <div className="bg-info bg-opacity-10 p-3 rounded-circle me-3">
                  <Users className="text-info" size={24} />
                </div>
                <div>
                  <h6 className="text-muted mb-1 small">Top Department</h6>
                  <h3 className="mb-0 fw-bold fs-5">{data.kpis.topDept}</h3>
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
                  <h6 className="text-muted mb-1 small">Distraction Alerts</h6>
                  <h3 className="mb-0 fw-bold">{data.kpis.alerts}</h3>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Historical Trend Analysis */}
        <div className="row g-4 mb-4">
          <div className="col-md-8">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-0">
                <h6 className="fw-bold mb-0">Engagement Trend (Last 30 Days)</h6>
              </div>
              <div className="card-body" style={{ height: '300px', position: 'relative' }}>
                <Line 
                  data={lineData} 
                  options={{ 
                    maintainAspectRatio: false, 
                    plugins: { legend: { display: false } },
                    scales: { y: { min: 40, max: 100 } }
                  }} 
                />
              </div>
            </div>
          </div>
          <div className="col-md-4">
            <div className="card glass-card h-100 border-0 shadow-sm">
              <div className="card-header bg-transparent border-bottom-0 pt-4 pb-0">
                <h6 className="fw-bold mb-0">Department Comparison</h6>
              </div>
              <div className="card-body" style={{ height: '300px', position: 'relative' }}>
                <Bar 
                  data={barData} 
                  options={{ 
                    maintainAspectRatio: false, 
                    plugins: { legend: { display: false } },
                    scales: { x: { grid: { display: false } } }
                  }} 
                />
              </div>
            </div>
          </div>
        </div>

        {/* Deep-Dive Post-Session Reports */}
        <div className="card glass-card border-0 shadow-sm mb-4">
          <div className="card-header bg-transparent border-bottom pt-4 pb-3">
            <h6 className="fw-bold mb-0">Recent Post-Session Reports</h6>
          </div>
          <div className="card-body p-0">
            <div className="table-responsive">
              <table className="table table-hover align-middle mb-0">
                <thead className="bg-light">
                  <tr>
                    <th className="ps-4 text-muted small fw-medium">Employee</th>
                    <th className="text-muted small fw-medium">Role</th>
                    <th className="text-muted small fw-medium">Date & Time</th>
                    <th className="text-muted small fw-medium">Session Duration</th>
                    <th className="text-muted small fw-medium">Engagement Score</th>
                    <th className="text-end pe-4 text-muted small fw-medium">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentSessions.map(session => (
                    <tr key={session.id}>
                      <td className="ps-4 fw-medium">{session.name}</td>
                      <td><span className="badge bg-secondary bg-opacity-10 text-secondary">{session.role}</span></td>
                      <td className="text-muted small">{session.date}</td>
                      <td>{session.duration}</td>
                      <td>
                        <div className="d-flex align-items-center">
                          <span className={`fw-bold me-2 ${session.score >= 80 ? 'text-success' : session.score >= 60 ? 'text-warning' : 'text-danger'}`}>
                            {session.score}%
                          </span>
                          <div className="progress flex-grow-1" style={{ height: '6px' }}>
                            <div 
                              className={`progress-bar ${session.score >= 80 ? 'bg-success' : session.score >= 60 ? 'bg-warning' : 'bg-danger'}`} 
                              style={{ width: `${session.score}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>
                      <td className="text-end pe-4">
                        <button className="btn btn-sm btn-outline-primary rounded-pill px-3">View Details</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
