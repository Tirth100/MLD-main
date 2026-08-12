import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { api } from '../api';

export default function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const result = await api.get('/alerts');
      if (Array.isArray(result)) setAlerts(result);
    } catch (error) {
      console.error("Failed to load alerts", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 2500);
    return () => clearInterval(interval);
  }, []);

  const dismissAlert = (index) => {
    const newAlerts = [...alerts];
    newAlerts.splice(index, 1);
    setAlerts(newAlerts);
  };

  const clearAll = () => {
    setAlerts([]);
  };

  return (
    <>
      <Sidebar />
      <main className="main-content">
          <header className="top-navbar mb-4 rounded-3 glass-card">
              <div className="d-flex align-items-center">
                  <h4 className="mb-0 fw-bold">Active Alerts</h4>
              </div>
              <div>
                  <button className="btn btn-outline-secondary btn-sm me-2" onClick={clearAll}>Clear All</button>
                  <button className="btn btn-primary btn-sm" onClick={fetchAlerts}><i className="bi bi-arrow-clockwise me-1"></i> Refresh</button>
              </div>
          </header>

          <div className="row">
              {loading && alerts.length === 0 ? (
                <div className="col-12 text-center mt-5"><div className="spinner-border text-primary" role="status"></div></div>
              ) : alerts.length === 0 ? (
                <div className="col-12">
                    <div className="text-muted text-center mt-5">No active alerts.</div>
                </div>
              ) : (
                alerts.map((alert, idx) => (
                  <div className="col-md-6 mb-4 alert-card" key={idx}>
                      <div className="card glass-card h-100 border-start border-danger border-4">
                          <div className="card-body">
                              <div className="d-flex justify-content-between align-items-center mb-3">
                                  <h5 className="card-title mb-0 fw-bold">{alert.name}</h5>
                                  <span className="badge bg-danger rounded-pill px-3 py-2">Low Engagement</span>
                              </div>
                              <p className="card-text text-muted mb-3">{alert.reason}</p>
                              <div className="d-flex justify-content-between align-items-center mt-auto">
                                  <small className="text-secondary"><i className="bi bi-clock me-1"></i>{alert.time}</small>
                                  <button className="btn btn-sm btn-outline-danger" onClick={() => dismissAlert(idx)}>Dismiss</button>
                              </div>
                          </div>
                      </div>
                  </div>
                ))
              )}
          </div>
      </main>
    </>
  );
}
