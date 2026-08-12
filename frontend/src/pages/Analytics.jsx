import { useState, useEffect } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement } from 'chart.js';
import { Doughnut, Bar, Line } from 'react-chartjs-2';
import Sidebar from '../components/Sidebar';
import { api } from '../api';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, PointElement, LineElement, BarElement);

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchAnalytics = async () => {
    try {
      const result = await api.get('/analytics');
      setData(result);
    } catch (error) {
      console.error("Failed to load analytics", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 2500);
    return () => clearInterval(interval);
  }, []);



  const pData = data?.windowFocus || [0, 0, 1];
  const finalPData = pData[0] === 0 && pData[1] === 0 && pData[2] === 0 ? [0, 0, 1] : pData;

  const pieData = {
    labels: ['Focused', 'Blurred', 'Background/Hidden'],
    datasets: [{
      data: finalPData,
      backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const barData = {
    labels: ['10m', '20m', '30m', '40m', '50m', '60m'],
    datasets: [{
      label: 'Messages Sent',
      data: data?.chatActivity || [0,0,0,0,0,0],
      backgroundColor: '#0ea5e9',
      borderRadius: 4
    }]
  };

  const lineData = {
    labels: data?.speakingTime || ['0s', '10s', '20s', '30s'],
    datasets: [{
      label: 'Speaking Duration (s)',
      data: data?.speakingData || [0,0,0,0],
      borderColor: '#7c3aed',
      backgroundColor: 'rgba(124, 58, 237, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };

  return (
    <>
      <Sidebar />
      <main className="main-content">
          <header className="top-navbar mb-4 rounded-3 glass-card">
              <div className="d-flex align-items-center">
                  <h4 className="mb-0 fw-bold">Analytics & Trends</h4>
              </div>
          </header>

          <div className="row g-4 mb-4">
              <div className="col-md-6 col-lg-4">
                  <div className="card glass-card h-100">
                      <div className="card-header bg-transparent border-bottom border-secondary py-3">
                          <h6 className="mb-0 fw-bold">Window Focus Breakdown</h6>
                      </div>
                      <div className="card-body" style={{position: 'relative', height: '300px'}}>
                          <Doughnut data={pieData} options={{ maintainAspectRatio: false, animation: {duration: 0}, plugins: { legend: { position: 'bottom', labels: { color: '#1e293b' } } } }} />
                      </div>
                  </div>
              </div>

              <div className="col-md-6 col-lg-8">
                  <div className="card glass-card h-100">
                      <div className="card-header bg-transparent border-bottom border-secondary py-3">
                          <h6 className="mb-0 fw-bold">Chat Interaction Frequency</h6>
                      </div>
                      <div className="card-body" style={{position: 'relative', height: '300px'}}>
                          <Bar data={barData} options={{ maintainAspectRatio: false, animation: {duration: 0}, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }} />
                      </div>
                  </div>
              </div>
          </div>

          <div className="row g-4">
              <div className="col-12">
                  <div className="card glass-card h-100">
                      <div className="card-header bg-transparent border-bottom border-secondary py-3 d-flex justify-content-between align-items-center">
                          <h6 className="mb-0 fw-bold">Average Speaking Activity (Duration)</h6>
                          <div className="dropdown">
                              <button className="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                  Last 7 Days
                              </button>
                              <ul className="dropdown-menu">
                                  <li><a className="dropdown-item" href="#">Today</a></li>
                                  <li><a className="dropdown-item" href="#">Last 7 Days</a></li>
                                  <li><a className="dropdown-item" href="#">This Month</a></li>
                              </ul>
                          </div>
                      </div>
                      <div className="card-body" style={{position: 'relative', height: '400px'}}>
                          <Line data={lineData} options={{ maintainAspectRatio: false, animation: {duration: 0}, scales: { y: { beginAtZero: true } }, plugins: { legend: { display: false } } }} />
                      </div>
                  </div>
              </div>
          </div>
      </main>
    </>
  );
}
