import Sidebar from '../components/Sidebar';

export default function MobileAgent() {
  return (
    <>
      <Sidebar />
      <main className="main-content">
          <header className="top-navbar mb-4 rounded-3 glass-card">
              <div className="d-flex align-items-center">
                  <h4 className="mb-0 fw-bold">Mobile App Setup</h4>
              </div>
          </header>

          <div className="row g-4">
              <div className="col-12">
                  <div className="card glass-card">
                      <div className="card-body">
                          <p className="text-muted py-4">Download the MLD Android App from the releases page.</p>
                      </div>
                  </div>
              </div>
          </div>
      </main>
    </>
  );
}
