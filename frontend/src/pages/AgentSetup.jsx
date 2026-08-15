import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiBaseUrl } from '../api';

export default function AgentSetup() {
  const [agentStatus, setAgentStatus] = useState('Checking Status...');
  const [statusClass, setStatusClass] = useState('bg-secondary');
  const [statusIcon, setStatusIcon] = useState('bi-circle-fill text-warning');
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState(null);

  const token = localStorage.getItem('uuid_token') || '';

  const checkAgentStatus = async () => {
    try {
      setLastCheckedTime(new Date().toLocaleTimeString());
      
      let localAgentAlive = false;
      let localAgentUuid = null;
      try {
        const localController = new AbortController();
        const localTimeoutId = setTimeout(() => localController.abort(), 2000);
        const localResponse = await fetch('http://127.0.0.1:14321/ping', {
          signal: localController.signal,
          cache: 'no-store'
        });
        clearTimeout(localTimeoutId);
        
        if (localResponse.ok) {
          const localData = await localResponse.json();
          if (localData && localData.status === 'ok') {
            localAgentAlive = true;
            localAgentUuid = localData.uuid;
          }
        }
      } catch (err) {
        // Local agent not running or unreachable
      }

      if (localAgentAlive) {
        if (localAgentUuid === token && token) {
          setStatusClass('bg-success text-white');
          setStatusIcon('bi-check-circle-fill');
          setAgentStatus('Connected & Active');
          setIsConnected(true);
        } else {
          setStatusClass('bg-warning text-dark');
          setStatusIcon('bi-exclamation-triangle-fill');
          setAgentStatus('Agent Running (Other Account)');
          setIsConnected(false);
        }
      } else {
        if (token) {
          setStatusClass('bg-warning text-dark');
          setStatusIcon('bi-exclamation-triangle-fill');
          setAgentStatus('Offline / Waiting for Link');
          setIsConnected(false);
        } else {
          setStatusClass('bg-danger text-white');
          setStatusIcon('bi-x-circle-fill');
          setAgentStatus('Not Installed');
          setIsConnected(false);
        }
      }
    } catch (e) {
      setStatusClass('bg-secondary text-white');
      setStatusIcon('bi-question-circle');
      setAgentStatus('Error Checking');
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkAgentStatus();
    const interval = setInterval(checkAgentStatus, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleVerify = () => {
    setIsChecking(true);
    setTimeout(checkAgentStatus, 600);
  };

  const handleCopyToken = () => {
    if (token) {
      navigator.clipboard.writeText(token);
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2500);
    }
  };

  const downloadUrl = '/MLDAgent.msi?v=7';
  const protocolLink = `mld-agent://link?token=${token}`;

  return (
    <div id="agentSetupPage" className="bg-light" style={{ minHeight: '100vh' }}>
      
      {/* Top Navigation */}
      <nav className="navbar navbar-expand-lg border-bottom sticky-top" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
        <div className="container px-4 py-2">
          <Link className="navbar-brand d-flex align-items-center text-dark" to="/">
            <i className="bi bi-radar text-primary fs-3 me-2"></i>
            <span className="fs-5 fw-bold">MLD Agent Hub</span>
          </Link>
          <div className="d-flex align-items-center gap-3">
            <Link to="/employee-dashboard" className="btn btn-sm btn-outline-primary shadow-sm">
              <i className="bi bi-speedometer2 me-1"></i>Employee Dashboard
            </Link>
            <Link 
              to="/" 
              onClick={() => { localStorage.removeItem('uuid_token'); localStorage.removeItem('user_role'); }} 
              className="btn btn-sm btn-outline-danger shadow-sm"
            >
              <i className="bi bi-box-arrow-left me-1"></i>Logout
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container py-5">
        
        {/* Hero Banner with Live Status */}
        <div className="row mb-5">
          <div className="col-12">
            <div className="card glass-card border-0 bg-primary bg-opacity-10 shadow-sm overflow-hidden">
              <div className="card-body p-4 p-md-5 d-flex justify-content-between align-items-center flex-wrap gap-4">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-primary px-3 py-2 rounded-pill"><i className="bi bi-windows me-1"></i>Official Windows MSI Package</span>
                    <span className="badge bg-light text-dark border px-3 py-2 rounded-pill"><i className="bi bi-cpu me-1"></i>Bundled JRE (No Java Setup Required)</span>
                  </div>
                  <h1 className="fw-bold mb-2 text-dark">Connect Your Desktop Workstation</h1>
                  <p className="text-muted mb-0" style={{ maxWidth: '650px' }}>
                    Install the native <strong>MLD Agent</strong> to participate in real-time meeting telemetry sessions. Powered by Windows MSI technology and seamless one-click pairing.
                  </p>
                </div>
                <div className="text-end">
                  <div className="p-3 bg-white rounded-3 shadow-sm border text-center" style={{ minWidth: '220px' }}>
                    <small className="text-muted d-block mb-1 fw-semibold">Live Connection Status</small>
                    <span className={`badge ${statusClass} fs-6 px-3 py-2 shadow-sm rounded-pill d-inline-flex align-items-center justify-content-center gap-1`}>
                      {isChecking ? (
                        <><span className="spinner-border spinner-border-sm me-1"></span> Verifying...</>
                      ) : (
                        <><i className={`bi ${statusIcon}`}></i> {agentStatus}</>
                      )}
                    </span>
                    {lastCheckedTime && (
                      <small className="text-muted d-block mt-2" style={{ fontSize: '0.75rem' }}>
                        Last checked: {lastCheckedTime}
                      </small>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 3-Step Guided MSI Setup Flow */}
        <div className="row mb-5">
          <div className="col-12">
            <h4 className="fw-bold mb-4 text-dark"><i className="bi bi-diagram-3 text-primary me-2"></i>Quick 3-Step Setup Process</h4>
          </div>

          {/* Step 1 Card */}
          <div className="col-md-4 mb-4 mb-md-0">
            <div className="card h-100 border-0 shadow-sm rounded-3 hover-shadow transition-all bg-white">
              <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="badge bg-primary bg-opacity-10 text-primary rounded-circle p-3 fs-5" style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    1
                  </div>
                  <div>
                    <h5 className="fw-bold mb-0">Download MSI</h5>
                    <small className="text-muted">Single Windows Installer</small>
                  </div>
                </div>
                <p className="text-muted small flex-grow-1">
                  Get the official <strong>MLDAgent.msi</strong> installer. Comes with a self-contained runtime so you don't need to install or configure Java manually.
                </p>
                <div className="mt-3 pt-3 border-top">
                  <span className="badge bg-light text-muted border"><i className="bi bi-file-earmark-binary me-1"></i>Windows 10/11 (64-bit)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 2 Card */}
          <div className="col-md-4 mb-4 mb-md-0">
            <div className="card h-100 border-0 shadow-sm rounded-3 hover-shadow transition-all bg-white">
              <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className="badge bg-primary bg-opacity-10 text-primary rounded-circle p-3 fs-5" style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    2
                  </div>
                  <div>
                    <h5 className="fw-bold mb-0">Install Package</h5>
                    <small className="text-muted">Standard Setup Wizard</small>
                  </div>
                </div>
                <p className="text-muted small flex-grow-1">
                  Double-click the downloaded <strong>.msi</strong> file and install it. <strong>Important:</strong> After installation, open your Windows Start Menu, search for <strong>"MLD Agent"</strong>, and click it to run the agent in the background.
                </p>
                <div className="mt-3 pt-3 border-top">
                  <span className="badge bg-light text-muted border"><i className="bi bi-shield-check text-success me-1"></i>System Tray Background App</span>
                </div>
              </div>
            </div>
          </div>

          {/* Step 3 Card */}
          <div className="col-md-4">
            <div className="card h-100 border-0 shadow-sm rounded-3 hover-shadow transition-all bg-white">
              <div className="card-body p-4 d-flex flex-column">
                <div className="d-flex align-items-center gap-3 mb-3">
                  <div className={`badge ${isConnected ? 'bg-success' : 'bg-primary'} bg-opacity-10 ${isConnected ? 'text-success' : 'text-primary'} rounded-circle p-3 fs-5`} style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    3
                  </div>
                  <div>
                    <h5 className="fw-bold mb-0">1-Click Link</h5>
                    <small className="text-muted">Instant Account Pairing</small>
                  </div>
                </div>
                <p className="text-muted small flex-grow-1">
                  Click <strong>Link Agent Now</strong> below to pair your account automatically. <strong>Fallback:</strong> If the button doesn't open the agent, use the manual token fallback below and run <code>MLD Agent.exe</code> with it.
                </p>
                <div className="mt-3 pt-3 border-top">
                  <span className={`badge ${isConnected ? 'bg-success text-white' : 'bg-light text-primary border'}`}>
                    <i className={`bi ${isConnected ? 'bi-check-circle-fill' : 'bi-link-45deg'} me-1`}></i>
                    {isConnected ? 'Paired & Verified' : 'One-Click Trigger'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Deck & Live Diagnostics */}
        <div className="row g-4 mb-5">
          
          {/* Left Column: Primary Download & Link Action Card */}
          <div className="col-lg-7">
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4 p-md-5 text-center h-100 d-flex flex-column justify-content-between">
              <div>
                <div className="badge bg-primary bg-opacity-10 text-primary p-3 rounded-circle mb-3 fs-3">
                  <i className="bi bi-cloud-arrow-down-fill"></i>
                </div>
                <h3 className="fw-bold mb-2">Get Started with MLD Agent</h3>
                <p className="text-muted mb-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
                  Download the official Windows installer and pair your workstation in under 60 seconds.
                </p>

                <div className="d-flex flex-column flex-sm-row gap-3 justify-content-center mb-4">
                  <a 
                    href={downloadUrl} 
                    download="MLDAgent.msi" 
                    className="btn btn-primary btn-lg px-4 py-3 shadow fs-6 fw-bold d-inline-flex align-items-center justify-content-center"
                  >
                    <i className="bi bi-download me-2"></i>Download MLD Agent (.msi)
                  </a>

                  <a 
                    href={protocolLink} 
                    className="btn btn-outline-primary btn-lg px-4 py-3 shadow-sm fs-6 fw-bold d-inline-flex align-items-center justify-content-center"
                  >
                    <i className="bi bi-link-45deg me-2"></i>Link Agent Now
                  </a>
                </div>

                <div className="d-flex align-items-center justify-content-center gap-4 text-muted small mb-4">
                  <span><i className="bi bi-shield-check text-success me-1"></i>Verified Safe</span>
                  <span><i className="bi bi-patch-check text-primary me-1"></i>MSI Format</span>
                  <span><i className="bi bi-windows text-info me-1"></i>Win 10/11 Ready</span>
                </div>
              </div>

              {/* Manual Token Fallback */}
              <div className="p-3 bg-light rounded-3 text-start border mt-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="fw-bold text-dark"><i className="bi bi-key-fill text-primary me-1"></i>Your Account Pairing Token</small>
                  {copiedToken && <span className="badge bg-success text-white">Copied!</span>}
                </div>
                <div className="input-group input-group-sm">
                  <input 
                    type="text" 
                    className="form-control font-monospace bg-white border text-muted" 
                    value={token || 'Not logged in'} 
                    readOnly 
                  />
                  <button 
                    className="btn btn-outline-secondary" 
                    type="button" 
                    onClick={handleCopyToken}
                    disabled={!token}
                  >
                    <i className="bi bi-clipboard me-1"></i>Copy
                  </button>
                </div>
                <small className="text-muted d-block mt-1" style={{ fontSize: '0.75rem' }}>
                  If the Link button doesn't work, press <strong>Win + R</strong>, type <code>"C:\Program Files\MLD Agent\MLD Agent.exe" mld-agent://link?token={token || 'YOUR_TOKEN'}</code> and hit Enter.
                </small>
              </div>

            </div>
          </div>

          {/* Right Column: System Tray & Connection Diagnostic Deck */}
          <div className="col-lg-5">
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4 h-100 d-flex flex-column justify-content-between">
              <div>
                <h5 className="fw-bold mb-3 text-dark"><i className="bi bi-activity text-primary me-2"></i>Agent Diagnostics</h5>
                
                {/* Diagnostics Checklist */}
                <div className="list-group list-group-flush mb-4">
                  <div className="list-group-item bg-transparent px-0 py-2 d-flex align-items-center justify-content-between">
                    <span className="small text-muted"><i className="bi bi-hdd-network me-2 text-primary"></i>Server Backend</span>
                    <span className="badge bg-success bg-opacity-10 text-success">Online</span>
                  </div>
                  <div className="list-group-item bg-transparent px-0 py-2 d-flex align-items-center justify-content-between">
                    <span className="small text-muted"><i className="bi bi-laptop me-2 text-primary"></i>Desktop Agent Heartbeat</span>
                    <span className={`badge ${isConnected ? 'bg-success bg-opacity-10 text-success' : 'bg-warning bg-opacity-10 text-warning'}`}>
                      {isConnected ? 'Active & Receiving' : 'Waiting for Agent'}
                    </span>
                  </div>
                  <div className="list-group-item bg-transparent px-0 py-2 d-flex align-items-center justify-content-between">
                    <span className="small text-muted"><i className="bi bi-diagram-2 me-2 text-primary"></i>Protocol Handler</span>
                    <span className="badge bg-info bg-opacity-10 text-info">mld-agent://</span>
                  </div>
                </div>

                {/* System Tray Guide */}
                <div className="p-3 bg-light rounded-3 border mb-3">
                  <h6 className="fw-bold text-dark small mb-2"><i className="bi bi-app-indicator text-primary me-1"></i>Windows System Tray Helper</h6>
                  <p className="text-muted small mb-2">
                    Once installed, look for the <strong>MLD Agent</strong> icon in the bottom right corner of your Windows taskbar next to the clock.
                  </p>
                  <ul className="small text-muted ps-3 mb-0">
                    <li>Right-click the icon to view connection status.</li>
                    <li>The agent stays idle until a meeting session is initiated.</li>
                  </ul>
                </div>
              </div>

              {/* Verify Connection Button */}
              <button 
                className="btn btn-outline-primary w-100 py-2 fw-semibold d-flex align-items-center justify-content-center gap-2"
                onClick={handleVerify}
                disabled={isChecking}
              >
                {isChecking ? (
                  <><span className="spinner-border spinner-border-sm"></span> Testing Connection...</>
                ) : (
                  <><i className="bi bi-arrow-repeat"></i> Test & Refresh Connection</>
                )}
              </button>

            </div>
          </div>

        </div>

        {/* Privacy & Enterprise Security Guarantees */}
        <div className="row g-4 mb-5">
          <div className="col-md-4">
            <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
              <div className="d-flex align-items-center gap-3 mb-2">
                <i className="bi bi-shield-lock-fill text-primary fs-3"></i>
                <h6 className="fw-bold mb-0">Session-Restricted Tracking</h6>
              </div>
              <p className="text-muted small mb-0">
                Zero tracking outside authorized meetings. Telemetry begins strictly when your manager starts a session and ends immediately when finished.
              </p>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
              <div className="d-flex align-items-center gap-3 mb-2">
                <i className="bi bi-incognito text-success fs-3"></i>
                <h6 className="fw-bold mb-0">Zero Keystroke / Screen Recording</h6>
              </div>
              <p className="text-muted small mb-0">
                The agent never captures screenshots, keystrokes, or private messages. Only high-level active window titles and engagement states are evaluated.
              </p>
            </div>
          </div>

          <div className="col-md-4">
            <div className="card border-0 shadow-sm rounded-3 p-4 bg-white h-100">
              <div className="d-flex align-items-center gap-3 mb-2">
                <i className="bi bi-lightning-charge-fill text-warning fs-3"></i>
                <h6 className="fw-bold mb-0">Ultra-Light Footprint</h6>
              </div>
              <p className="text-muted small mb-0">
                Engineered with high-performance native hooks consuming &lt;0.5% CPU and minimal RAM, ensuring smooth operation with zero PC lag.
              </p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div className="row">
          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-3 bg-white p-4 p-md-5">
              <h4 className="fw-bold mb-4 text-dark"><i className="bi bi-question-circle text-primary me-2"></i>Frequently Asked Questions</h4>
              
              <div className="accordion accordion-flush" id="faqAccordion">
                <div className="accordion-item bg-transparent">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq1">
                      Do I need to install Java before running the MSI installer?
                    </button>
                  </h2>
                  <div id="faq1" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body text-muted small">
                      No. The new <strong>MSI Package</strong> includes a dedicated, self-contained Java Runtime Environment (JRE). It runs seamlessly on any Windows 10 or Windows 11 machine without any prerequisites.
                    </div>
                  </div>
                </div>

                <div className="accordion-item bg-transparent">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq2">
                      What does the "Link Agent Now" button do?
                    </button>
                  </h2>
                  <div id="faq2" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body text-muted small">
                      It sends a secure token to the installed desktop application using the Windows <code>mld-agent://</code> protocol. When your browser asks for confirmation, click <strong>Open MLD Agent</strong> to complete the pairing.
                    </div>
                  </div>
                </div>

                <div className="accordion-item bg-transparent">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                      Does the agent monitor activities when there is no meeting?
                    </button>
                  </h2>
                  <div id="faq3" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body text-muted small">
                      No. When no session is active, the agent sits silently in your Windows System Tray in sleep mode without sending any telemetry to the server.
                    </div>
                  </div>
                </div>

                <div className="accordion-item bg-transparent">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq4">
                      Do I need to re-link my agent after restarting Windows?
                    </button>
                  </h2>
                  <div id="faq4" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body text-muted small">
                      No. Once paired, your token is securely persisted on your machine. The agent starts automatically on Windows login and reconnects to your account.
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
