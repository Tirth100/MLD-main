import Sidebar from '../components/Sidebar';

export default function Reports() {
  return (
    <>
      <Sidebar />
      <main className="main-content">
          <header className="top-navbar mb-4 rounded-3 glass-card">
              <div className="d-flex align-items-center">
                  <h4 className="mb-0 fw-bold">Reports</h4>
              </div>
          </header>

          <div className="row g-4">
              <div className="col-12">
                  <div className="card glass-card">
                      <div className="card-body">
                          <p className="text-muted text-center py-4">Reports generation feature is currently being migrated.</p>
                      </div>
                  </div>
              </div>
          </div>
      </main>
    </>
  );
}
