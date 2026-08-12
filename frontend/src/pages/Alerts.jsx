import Sidebar from '../components/Sidebar';

export default function Alerts() {
  return (
    <>
      <Sidebar />
      <main className="main-content">
          <header className="top-navbar mb-4 rounded-3 glass-card">
              <div className="d-flex align-items-center">
                  <h4 className="mb-0 fw-bold">Active Alerts</h4>
              </div>
              <div>
                  <button className="btn btn-outline-secondary btn-sm me-2">Clear All</button>
                  <button className="btn btn-primary btn-sm"><i className="bi bi-arrow-clockwise me-1"></i> Refresh</button>
              </div>
          </header>

          <div className="row">
              <div className="col-12">
                  <div className="text-muted text-center mt-5">No active alerts.</div>
              </div>
          </div>
      </main>
    </>
  );
}
