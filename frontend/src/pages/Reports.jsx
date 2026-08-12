import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { api } from '../api';

export default function Reports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    try {
      const result = await api.get('/engagement');
      if (Array.isArray(result)) {
        setData(result.reverse());
      }
    } catch (error) {
      console.error("Failed to load reports", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async (timestamp) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await api.delete(`/engagement?timestamp=${encodeURIComponent(timestamp)}`);
        fetchReports();
      } catch (error) {
        alert("Error deleting record.");
      }
    }
  };

  return (
    <>
      <Sidebar />
      <main className="main-content">
          <header className="top-navbar mb-4 rounded-3 glass-card">
              <div className="d-flex align-items-center">
                  <h4 className="mb-0 fw-bold">Reports</h4>
              </div>
              <button className="btn btn-outline-primary" onClick={() => alert("Export module not configured yet.")}>Export CSV</button>
          </header>

          <div className="row g-4">
              <div className="col-12">
                  <div className="card glass-card">
                      <div className="card-body">
                          {loading && data.length === 0 ? (
                            <div className="text-center py-4"><div className="spinner-border text-primary" role="status"></div></div>
                          ) : data.length === 0 ? (
                            <p className="text-muted text-center py-4">No reports available.</p>
                          ) : (
                            <div className="table-responsive">
                                <table className="table align-middle custom-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Role</th>
                                            <th>Engagement Score</th>
                                            <th>Status</th>
                                            <th>Timestamp</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.map((emp, idx) => {
                                            const bgClass = emp.status === 'engaged' ? 'success' : (emp.status === 'low engagement' ? 'danger' : 'warning');
                                            return (
                                                <tr key={idx}>
                                                    <td>{emp.name}</td>
                                                    <td>{emp.role}</td>
                                                    <td>{emp.score}%</td>
                                                    <td>
                                                        <span className={`badge badge-soft-${bgClass} px-3 py-2 rounded-pill text-capitalize`}>{emp.status}</span>
                                                    </td>
                                                    <td><small className="text-muted">{emp.timestamp || 'N/A'}</small></td>
                                                    <td>
                                                        <button className="btn btn-sm btn-outline-primary me-2" onClick={() => alert("Timeline feature requires backend modification.")}>Actions</button>
                                                        <button className="btn btn-sm btn-outline-danger" onClick={() => handleDelete(emp.timestamp)}>Delete</button>
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
              </div>
          </div>
      </main>
    </>
  );
}
