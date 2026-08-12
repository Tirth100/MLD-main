import Sidebar from '../components/Sidebar';

export default function AgentSetup() {
  return (
    <>
      <Sidebar />
      <main className="main-content">
          <header className="top-navbar mb-4 rounded-3 glass-card">
              <div className="d-flex align-items-center">
                  <h4 className="mb-0 fw-bold">Desktop Agent Setup</h4>
              </div>
          </header>

          <div className="row g-4">
              <div className="col-12">
                  <div className="card glass-card">
                      <div className="card-body">
                          <p className="text-muted py-4">Download the MLD Desktop Agent for Windows/Mac.</p>
                          <a href="/MLD-Agent.zip" className="btn btn-primary">Download Agent (.zip)</a>
                      </div>
                  </div>
              </div>
          </div>
      </main>
    </>
  );
}
