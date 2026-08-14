import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';

export default function AgentSetup() {
  const [agentStatus, setAgentStatus] = useState('Checking Status...');
  const [statusClass, setStatusClass] = useState('bg-secondary');
  const [statusIcon, setStatusIcon] = useState('bi-circle-fill text-warning');
  const [isChecking, setIsChecking] = useState(false);

  const checkAgentStatus = async () => {
    const token = localStorage.getItem('uuid_token');
    try {
      const response = await api.get(`/agent-status?uuid=${token || ''}`);
      if (response && response.connected) {
        setStatusClass('bg-success');
        setStatusIcon('bi-check-circle-fill');
        setAgentStatus('Agent Status : Connected');
      } else if (token) {
        setStatusClass('bg-warning text-dark');
        setStatusIcon('bi-exclamation-triangle-fill');
        setAgentStatus('Agent Status : Offline');
      } else {
        setStatusClass('bg-danger');
        setStatusIcon('bi-x-circle-fill');
        setAgentStatus('Agent Status : Not Installed');
      }
    } catch(e) {
      setStatusClass('bg-secondary');
      setStatusIcon('bi-question-circle');
      setAgentStatus('Agent Status : Offline');
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkAgentStatus();
    const interval = setInterval(checkAgentStatus, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = () => {
    setIsChecking(true);
    setTimeout(checkAgentStatus, 800);
  };

  return (
    <div id="agentSetupPage" className="bg-light" style={{ minHeight: '100vh' }}>
      
      {/* Top Navbar */}
      <nav className="navbar navbar-expand-lg border-bottom border-secondary" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
          <div className="container px-4 py-1">
              <Link className="navbar-brand d-flex align-items-center text-dark" to="/">
                  <i className="bi bi-radar text-primary fs-3 me-2"></i>
                  <span className="fs-5 fw-bold">MLD Agent Setup</span>
              </Link>
              <div className="d-flex align-items-center gap-3">
                  <Link to="/employee-dashboard" className="btn btn-sm btn-outline-primary"><i className="bi bi-speedometer2 me-1"></i>Employee Dashboard</Link>
                  <Link to="/" onClick={() => { localStorage.removeItem('uuid_token'); localStorage.removeItem('user_role'); }} className="btn btn-sm btn-outline-danger"><i className="bi bi-box-arrow-left me-1"></i>Logout</Link>
              </div>
          </div>
      </nav>

      {/* Main Container */}
      <main className="container py-5">
          
          {/* Header Banner */}
          <div className="row mb-4">
              <div className="col-12">
                  <div className="card glass-card border-0 bg-primary bg-opacity-10 shadow-sm">
                      <div className="card-body p-4 d-flex justify-content-between align-items-center flex-wrap gap-3">
                          <div>
                              <span className="badge bg-primary px-3 py-2 rounded-pill mb-2"><i className="bi bi-shield-check me-1"></i>Official Desktop Client</span>
                              <h2 className="fw-bold mb-1">MLD Desktop Agent Setup</h2>
                              <p className="text-muted mb-0">Install the lightweight agent to connect your computer to authorized meeting monitoring sessions.</p>
                          </div>
                          <div className="text-end">
                              <div className="p-3 bg-white rounded shadow-sm border text-center">
                                  <small className="text-muted d-block mb-1">Current Agent Connection</small>
                                  <span className={`badge ${statusClass} fs-6 px-3 py-2 shadow-sm`}>
                                      {isChecking ? (
                                          <><span className="spinner-border spinner-border-sm me-1"></span> Checking...</>
                                      ) : (
                                          <><i className={`bi ${statusIcon} me-1`}></i> {agentStatus}</>
                                      )}
                                  </span>
                              </div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>

          <div className="row g-4">
              
              {/* Left Column */}
              <div className="col-lg-7">
                  
                  <div className="card glass-card border-0 mb-4 shadow-sm">
                      <div className="card-body p-4">
                          <h4 className="fw-bold mb-3"><i className="bi bi-info-circle text-primary me-2"></i>Section 1: What is MLD Agent?</h4>
                          <p className="text-muted leading-relaxed">
                              <strong>MLD Agent</strong> is a lightweight, secure background application installed on your computer. It monitors meeting engagement (such as active meeting window focus, camera status, and idle time) strictly during <strong>authorized monitoring sessions</strong> started by your organization manager.
                          </p>
                          <div className="alert alert-info border-0 d-flex align-items-center gap-2 mb-0">
                              <i className="bi bi-lock-fill fs-4 text-info"></i>
                              <small className="mb-0"><strong>Privacy Protection:</strong> MLD Agent performs zero tracking outside of active sessions. Once a session ends, monitoring stops immediately.</small>
                          </div>
                      </div>
                  </div>

                  <div className="card glass-card border-0 mb-4 shadow-sm">
                      <div className="card-body p-4">
                          <h4 className="fw-bold mb-4"><i className="bi bi-list-check text-primary me-2"></i>Section 2: Installation Steps</h4>
                          
                          <div className="d-flex align-items-start mb-3">
                              <div className="badge bg-primary rounded-circle p-3 me-3 fs-6">1</div>
                              <div>
                                  <h6 className="fw-bold mb-1">Step 1: Download MLD Agent</h6>
                                  <p className="text-muted small mb-0">Click the <strong>Download MLD Agent</strong> button below to get the official installer (.msi).</p>
                              </div>
                          </div>

                          <div className="d-flex align-items-start mb-3">
                              <div className="badge bg-primary rounded-circle p-3 me-3 fs-6">2</div>
                              <div>
                                  <h6 className="fw-bold mb-1">Step 2: Install the Agent</h6>
                                  <p className="text-muted small mb-0">Run the downloaded MSI file and follow the standard installation prompts.</p>
                              </div>
                          </div>

                          <div className="d-flex align-items-start mb-3">
                              <div className="badge bg-primary rounded-circle p-3 me-3 fs-6">3</div>
                              <div>
                                  <h6 className="fw-bold mb-1">Step 3: Link Agent</h6>
                                  <p className="text-muted small mb-0">Click the <strong>Link Agent</strong> button on the right column to securely pair your desktop agent with your account.</p>
                              </div>
                          </div>

                          <div className="d-flex align-items-start">
                              <div className="badge bg-success rounded-circle p-3 me-3 fs-6">4</div>
                              <div>
                                  <h6 className="fw-bold mb-1">Step 4: Verify Connection</h6>
                                  <p className="text-muted small mb-0">Wait for the badge to turn 🟢 <strong>Connected</strong> automatically.</p>
                              </div>
                          </div>
                      </div>
                  </div>

                  <div className="card glass-card border-primary border-2 mb-4 text-center py-4 bg-white shadow-sm">
                      <div className="card-body">
                          <h4 className="fw-bold mb-2">Ready to Install?</h4>
                          <p className="text-muted mb-4">Compatible with Windows 10/11</p>
                          
                          <a href="/MLDAgent.msi" download="MLDAgent.msi" className="btn btn-primary btn-lg px-5 py-3 shadow fs-5 fw-bold">
                              <i className="bi bi-download me-2"></i>Download MLD Agent (.msi)
                          </a>
                          <p className="text-muted small mt-3 mb-0"><i className="bi bi-shield-lock text-success me-1"></i>Verified Safe & Malware Free</p>
                      </div>
                  </div>

              </div>

              {/* Right Column */}
              <div className="col-lg-5">
                  
                  <div className="card glass-card border-0 mb-4 shadow-sm">
                      <div className="card-body p-4">
                          <h5 className="fw-bold mb-3"><i className="bi bi-link-45deg text-primary me-2"></i>Section 4: Link Your Agent</h5>
                          <p className="text-muted small">
                              After installing the agent, you must link it to your account. This is a one-time process.
                          </p>
                          <ul className="list-group list-group-flush border-0 mb-3">
                              <li className="list-group-item bg-transparent px-0 py-2 d-flex align-items-center">
                                  <i className="bi bi-check-circle-fill text-success me-2"></i>1. Ensure the MLD Agent is running.
                              </li>
                              <li className="list-group-item bg-transparent px-0 py-2 d-flex align-items-center">
                                  <i className="bi bi-check-circle-fill text-success me-2"></i>2. Click the <strong>Link Agent</strong> button below.
                              </li>
                              <li className="list-group-item bg-transparent px-0 py-2 d-flex align-items-center">
                                  <i className="bi bi-check-circle-fill text-success me-2"></i>3. When prompted, allow your browser to open the agent.
                              </li>
                          </ul>

                          <div className="mt-4 text-center d-flex flex-column gap-2">
                              <a 
                                href={`mld-agent://link?token=${localStorage.getItem('uuid_token')}`}
                                className="btn btn-primary w-100 py-2 fw-bold"
                              >
                                  <i className="bi bi-link-45deg me-1"></i>Link Agent Now
                              </a>
                              <button className="btn btn-outline-secondary w-100 py-2" onClick={handleVerify}>
                                  <i className="bi bi-arrow-repeat me-1"></i>Verify Connection
                              </button>
                          </div>
                      </div>
                  </div>

                  <div className="card glass-card border-0 shadow-sm">
                      <div className="card-body p-4">
                          <h5 className="fw-bold mb-3"><i className="bi bi-question-circle text-primary me-2"></i>Section 6: Frequently Asked Questions</h5>
                          
                          <div className="accordion accordion-flush" id="faqAccordion">
                              <div className="accordion-item bg-transparent">
                                  <h2 className="accordion-header">
                                      <button className="accordion-button collapsed bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                                          Do I need to keep the agent running all day?
                                      </button>
                                  </h2>
                                  <div id="faq1" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                      <div className="accordion-body text-muted small">
                                          No. The MLD Agent strictly performs monitoring during active sessions created by your organization manager.
                                      </div>
                                  </div>
                              </div>

                              <div className="accordion-item bg-transparent">
                                  <h2 className="accordion-header">
                                      <button className="accordion-button collapsed bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                                          Does the agent monitor activities outside sessions?
                                      </button>
                                  </h2>
                                  <div id="faq2" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                      <div className="accordion-body text-muted small">
                                          No. All telemetry and window tracking are restricted strictly to authorized monitoring sessions.
                                      </div>
                                  </div>
                              </div>

                              <div className="accordion-item bg-transparent">
                                  <h2 className="accordion-header">
                                      <button className="accordion-button collapsed bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                                          Do I need to reinstall after every update?
                                      </button>
                                  </h2>
                                  <div id="faq3" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                                      <div className="accordion-body text-muted small">
                                          No. Necessary updates are delivered automatically through the agent installer package.
                                      </div>
                                  </div>
                              </div>
                          </div>

                      </div>
                  </div>

              </div>

          </div>

      </main>
    </div>
  );
}
