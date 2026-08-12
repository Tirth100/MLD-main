import Sidebar from '../components/Sidebar';

export default function Analytics() {
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
                          <div className="text-muted text-center py-5 mt-4">Chart loading (dummy data)</div>
                      </div>
                  </div>
              </div>

              <div className="col-md-6 col-lg-8">
                  <div className="card glass-card h-100">
                      <div className="card-header bg-transparent border-bottom border-secondary py-3">
                          <h6 className="mb-0 fw-bold">Chat Interaction Frequency</h6>
                      </div>
                      <div className="card-body" style={{position: 'relative', height: '300px'}}>
                          <div className="text-muted text-center py-5 mt-4">Chart loading (dummy data)</div>
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
                          <div className="text-muted text-center py-5 mt-5">Chart loading (dummy data)</div>
                      </div>
                  </div>
              </div>
          </div>
      </main>
    </>
  );
}
