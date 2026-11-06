import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, getApiBaseUrl } from '../api';
import { isMobileDevice } from '../utils/device';

export default function AgentSetup() {
  const detectUserOS = () => {
    if (typeof window === 'undefined') return 'windows';
    const userAgent = window.navigator.userAgent || '';
    if (/Macintosh|Mac OS X/i.test(userAgent)) return 'macos';
    if (/Linux/i.test(userAgent)) return 'linux';
    return 'windows';
  };

  const detectedOS = detectUserOS();
  const [selectedOS, setSelectedOS] = useState(detectedOS);
  const [agentStatus, setAgentStatus] = useState('Checking Status...');
  const [statusClass, setStatusClass] = useState('bg-secondary');
  const [statusIcon, setStatusIcon] = useState('bi-circle-fill text-warning');
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState(null);
  const [onMobile] = useState(() => isMobileDevice());

  const token = localStorage.getItem('uuid_token') || '';

  const checkAgentStatus = async () => {
    if (!token) {
      setStatusClass('bg-danger text-white');
      setStatusIcon('bi-x-circle-fill');
      setAgentStatus('Not Logged In');
      setIsConnected(false);
      return;
    }

    try {
      setLastCheckedTime(new Date().toLocaleTimeString());
      
      // 1. Check Server Heartbeat status via Backend API (Cloud reliable)
      try {
        const serverRes = await api.get(`/agent-status?uuid=${encodeURIComponent(token)}`);
        if (serverRes && (serverRes.connected === true || serverRes.status === 'online' || serverRes.active === true)) {
          setStatusClass('bg-success text-white');
          setStatusIcon('bi-check-circle-fill');
          setAgentStatus('Connected & Active');
          setIsConnected(true);
          return;
        }
      } catch (srvErr) {
        // Backend check error, fallback to local
      }

      // 2. Check local HTTP ping listener fallback
      let localAgentAlive = false;
      let localAgentUuid = null;
      try {
        const localController = new AbortController();
        const localTimeoutId = setTimeout(() => localController.abort(), 1500);
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
        // Local agent unreachable
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
        setStatusClass('bg-warning text-dark');
        setStatusIcon('bi-exclamation-triangle-fill');
        setAgentStatus('Offline / Waiting for Link');
        setIsConnected(false);
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

  const protocolLink = `mld-agent://link?token=${token}`;

  const osDetails = {
    windows: {
      name: 'Windows',
      icon: 'bi-windows text-primary',
      badge: 'Win 10 / 11 (.exe Installer)',
      filename: 'MLD-Agent.exe',
      downloadUrl: '/MLD-Agent.exe',
      fileExt: '.exe',
      trayHelperName: 'Windows Taskbar System Tray',
      trayHelperDesc: 'Look for the MLD Agent icon in the bottom-right corner next to the Windows clock.',
      manualLinkCmd: `"C:\\Program Files\\MLD Agent\\MLD Agent.exe" mld-agent://link?token=${token || 'YOUR_TOKEN'}`,
      manualHint: 'Press Win + R, paste the command, and press Enter.',
      quickSteps: [
        { title: 'Download Executable', desc: 'Download MLD-Agent.exe for Windows.' },
        { title: 'Launch Agent', desc: 'Run the agent to start background telemetry in your system tray.' },
        { title: 'Link Account', desc: 'Click "Link Agent Now" to pair automatically.' }
      ]
    },
    macos: {
      name: 'macOS',
      icon: 'bi-apple text-dark',
      badge: 'macOS 11+ (.dmg Disk Image)',
      filename: 'MLD-Agent.dmg',
      downloadUrl: '/MLD-Agent.dmg',
      fileExt: '.dmg',
      trayHelperName: 'macOS Top Menu Bar',
      trayHelperDesc: 'Once opened, look for "● MLD" in your top menu bar next to the Wi-Fi icon.',
      manualLinkCmd: `hdiutil attach ~/Downloads/MLD-Agent.dmg && open "/Volumes/MLD Agent/MLD Agent.app"`,
      manualHint: 'Double-click MLD-Agent.dmg in your Downloads folder to mount and run.',
      quickSteps: [
        { title: 'Download Disk Image', desc: 'Download MLD-Agent.dmg for macOS.' },
        { title: 'Mount & Open', desc: 'Double-click MLD-Agent.dmg in your Downloads folder.' },
        { title: 'Menu Bar Status', desc: 'Agent runs as a silent status icon in your top menu bar.' }
      ]
    },
    linux: {
      name: 'Linux',
      icon: 'bi-ubuntu text-danger',
      badge: 'Universal (.AppImage & .deb)',
      filename: 'MLD-Agent.AppImage',
      downloadUrl: '/MLD-Agent.AppImage',
      debUrl: '/mld-agent.deb',
      fileExt: '.AppImage',
      trayHelperName: 'Linux Background Daemon / Systemd',
      trayHelperDesc: 'Runs as a portable AppImage or user systemd service with zero pip dependencies.',
      manualLinkCmd: `chmod +x ~/Downloads/MLD-Agent.AppImage && ~/Downloads/MLD-Agent.AppImage --token "${token || 'YOUR_TOKEN'}"`,
      manualHint: 'Make executable with chmod +x and run directly in terminal.',
      quickSteps: [
        { title: 'Download AppImage', desc: 'Download MLD-Agent.AppImage for any Linux distribution.' },
        { title: 'Make Executable', desc: 'Run: chmod +x MLD-Agent.AppImage in terminal.' },
        { title: 'Automatic Telemetry', desc: 'Active window (X11/Wayland) and camera presence ingested automatically.' }
      ]
    }
  };

  const currentOS = osDetails[selectedOS];

  return (
    <div id="agentSetupPage" className="bg-light" style={{ minHeight: '100vh' }}>
      
      {/* Top Navigation */}
      <nav className="navbar navbar-expand-lg border-bottom sticky-top" style={{ background: 'rgba(255, 255, 255, 0.95)', backdropFilter: 'blur(10px)' }}>
        <div className="container px-4 py-2">
          <Link className="navbar-brand d-flex align-items-center text-dark" to="/">
            <img src="/logo.png" alt="MLD" width="28" height="28" className="me-2 rounded-2 shadow-sm" />
            <span className="fs-5 fw-bold">MLD Agent Hub</span>
          </Link>
          <div className="d-flex align-items-center gap-3">
            <Link to="/employee-dashboard" className="btn btn-sm btn-outline-primary shadow-sm">
              <i className="bi bi-speedometer2 me-1"></i>Participant Dashboard
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
        <div className="row mb-4">
          <div className="col-12">
            <div className="card glass-card border-0 bg-primary bg-opacity-10 shadow-sm overflow-hidden">
              <div className="card-body p-4 p-md-5 d-flex justify-content-between align-items-center flex-wrap gap-4">
                <div>
                  <div className="d-flex align-items-center gap-2 mb-2">
                    <span className="badge bg-primary px-3 py-2 rounded-pill"><i className="bi bi-laptop me-1"></i>Cross-Platform Agent Hub</span>
                    <span className="badge bg-light text-dark border px-3 py-2 rounded-pill"><i className="bi bi-cpu me-1"></i>Seamless Pairing</span>
                  </div>
                  <h1 className="fw-bold mb-2 text-dark">Connect Your Workstation</h1>
                  <p className="text-muted mb-0" style={{ maxWidth: '650px' }}>
                    Install the native <strong>MLD Agent</strong> for your operating system to participate in meeting telemetry sessions with verified hardware presence.
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

        {/* Operating System Selector Tabs */}
        <div className="row mb-4">
          <div className="col-12">
            <div className="card border-0 shadow-sm rounded-3 bg-white p-3">
              <div className="d-flex align-items-center justify-content-between flex-wrap gap-3">
                <span className="fw-bold text-dark d-flex align-items-center gap-2">
                  <i className="bi bi-display text-primary fs-5"></i> Select Your Operating System:
                </span>
                <div className="btn-group shadow-sm" role="group">
                  <button
                    type="button"
                    className={`btn px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 ${selectedOS === 'windows' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setSelectedOS('windows')}
                  >
                    <i className="bi bi-windows"></i> Windows
                    {detectedOS === 'windows' && <span className="badge bg-light text-primary border ms-1">Detected</span>}
                  </button>
                  <button
                    type="button"
                    className={`btn px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 ${selectedOS === 'macos' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setSelectedOS('macos')}
                  >
                    <i className="bi bi-apple"></i> macOS
                    {detectedOS === 'macos' && <span className="badge bg-light text-primary border ms-1">Detected</span>}
                  </button>
                  <button
                    type="button"
                    className={`btn px-4 py-2 fw-semibold d-inline-flex align-items-center gap-2 ${selectedOS === 'linux' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => setSelectedOS('linux')}
                  >
                    <i className="bi bi-ubuntu"></i> Linux
                    {detectedOS === 'linux' && <span className="badge bg-light text-primary border ms-1">Detected</span>}
                  </button>
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
                  <i className={`bi ${currentOS.icon}`}></i>
                </div>
                <h3 className="fw-bold mb-1">MLD Agent for {currentOS.name}</h3>
                <span className="badge bg-light text-secondary border px-3 py-1.5 rounded-pill mb-3">
                  {currentOS.badge}
                </span>
                <p className="text-muted mb-4" style={{ maxWidth: '480px', margin: '0 auto' }}>
                  Download the native {currentOS.name} agent and pair your workstation in under 60 seconds.
                </p>

                {onMobile && (
                  <div className="alert alert-warning text-start small mb-4">
                    <i className="bi bi-phone me-2"></i>
                    Desktop installers are for PC/Mac/Linux. On a phone or tablet? Use the{' '}
                    <Link to="/mobile-agent" className="alert-link">mobile web agent</Link>{' '}
                    instead — no install required.
                  </div>
                )}

                <div className="d-flex flex-column flex-sm-row gap-3 justify-content-center mb-4 flex-wrap">
                  <a 
                    href={currentOS.downloadUrl} 
                    download={currentOS.filename}
                    className="btn btn-primary btn-lg px-4 py-3 shadow fs-6 fw-bold d-inline-flex align-items-center justify-content-center"
                  >
                    <i className="bi bi-download me-2"></i>Download for {currentOS.name} ({currentOS.fileExt})
                  </a>

                  {currentOS.debUrl && (
                    <a 
                      href={currentOS.debUrl} 
                      download="mld-agent.deb"
                      className="btn btn-outline-secondary btn-lg px-3 py-3 shadow-sm fs-6 fw-bold d-inline-flex align-items-center justify-content-center"
                      title="Download Debian/Ubuntu package"
                    >
                      <i className="bi bi-box-seam me-2"></i>Download .deb
                    </a>
                  )}

                  <a 
                    href={protocolLink} 
                    className="btn btn-outline-primary btn-lg px-4 py-3 shadow-sm fs-6 fw-bold d-inline-flex align-items-center justify-content-center"
                  >
                    <i className="bi bi-link-45deg me-2"></i>Link Agent Now
                  </a>
                </div>

                <div className="d-flex align-items-center justify-content-center gap-4 text-muted small mb-4 flex-wrap">
                  <span><i className="bi bi-shield-check text-success me-1"></i>Verified Safe</span>
                  <span><i className="bi bi-cpu text-info me-1"></i>&lt;0.5% CPU Footprint</span>
                  <span><i className="bi bi-incognito text-warning me-1"></i>Zero Screen Recording</span>
                </div>
              </div>

              {/* Manual Token Fallback */}
              <div className="p-3 bg-light rounded-3 text-start border mt-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <small className="fw-bold text-dark"><i className="bi bi-key-fill text-primary me-1"></i>Your Account Pairing Token</small>
                  {copiedToken && <span className="badge bg-success text-white">Copied!</span>}
                </div>
                <div className="input-group input-group-sm mb-2">
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
                <div className="p-2 bg-white rounded border small text-muted font-monospace text-break mb-1">
                  <code>{currentOS.manualLinkCmd}</code>
                </div>
                <small className="text-muted d-block" style={{ fontSize: '0.75rem' }}>
                  <i className="bi bi-info-circle me-1"></i>{currentOS.manualHint}
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
                  <div className="list-group-item bg-transparent px-0 py-2 d-flex align-items-center justify-content-between">
                    <span className="small text-muted"><i className="bi bi-shield-check me-2 text-primary"></i>Active Platform</span>
                    <span className="badge bg-light text-dark border">{currentOS.name}</span>
                  </div>
                </div>

                {/* System Tray Guide tailored to OS */}
                <div className="p-3 bg-light rounded-3 border mb-3">
                  <h6 className="fw-bold text-dark small mb-2"><i className="bi bi-app-indicator text-primary me-1"></i>{currentOS.trayHelperName}</h6>
                  <p className="text-muted small mb-2">
                    {currentOS.trayHelperDesc}
                  </p>
                  <ul className="small text-muted ps-3 mb-0">
                    <li>The agent stays idle until an official meeting session starts.</li>
                    <li>Telemetry stops and releases hardware immediately when the session ends.</li>
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

        {/* 3-Step Guided Setup Flow */}
        <div className="row mb-5">
          <div className="col-12">
            <h4 className="fw-bold mb-4 text-dark"><i className="bi bi-diagram-3 text-primary me-2"></i>Quick 3-Step Setup for {currentOS.name}</h4>
          </div>

          {currentOS.quickSteps.map((step, idx) => (
            <div className="col-md-4 mb-4 mb-md-0" key={idx}>
              <div className="card h-100 border-0 shadow-sm rounded-3 hover-shadow transition-all bg-white">
                <div className="card-body p-4 d-flex flex-column">
                  <div className="d-flex align-items-center gap-3 mb-3">
                    <div className="badge bg-primary bg-opacity-10 text-primary rounded-circle p-3 fs-5" style={{ width: '48px', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {idx + 1}
                    </div>
                    <div>
                      <h5 className="fw-bold mb-0">{step.title}</h5>
                      <small className="text-muted">Step {idx + 1}</small>
                    </div>
                  </div>
                  <p className="text-muted small flex-grow-1">
                    {step.desc}
                  </p>
                  <div className="mt-3 pt-3 border-top">
                    <span className="badge bg-light text-muted border">
                      <i className={`bi ${currentOS.icon} me-1`}></i>{currentOS.name} Compatible
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
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
                Zero tracking outside authorized meetings. Telemetry begins strictly when your host starts a session and ends immediately when finished.
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
                      Which operating systems are supported?
                    </button>
                  </h2>
                  <div id="faq1" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body text-muted small">
                      MLD provides official desktop agents for <strong>Windows 10/11</strong>, <strong>macOS (Apple Silicon & Intel)</strong>, and <strong>Linux (Ubuntu, Debian, Fedora, Arch)</strong>. Mobile devices (iOS/Android) can participate directly using the web portal without installing software.
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
                      It sends your pairing token to the installed desktop application via the registered <code>mld-agent://</code> protocol handler. When your browser displays a prompt, click <strong>Open MLD Agent</strong> to complete pairing.
                    </div>
                  </div>
                </div>

                <div className="accordion-item bg-transparent">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq3">
                      Does the agent monitor activities when there is no active session?
                    </button>
                  </h2>
                  <div id="faq3" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body text-muted small">
                      No. When no session is active, the agent remains completely dormant in standby mode without sending telemetry to the server.
                    </div>
                  </div>
                </div>

                <div className="accordion-item bg-transparent">
                  <h2 className="accordion-header">
                    <button className="accordion-button collapsed bg-transparent fw-bold" type="button" data-bs-toggle="collapse" data-bs-target="#faq4">
                      Do I need to re-link my agent after restarting my computer?
                    </button>
                  </h2>
                  <div id="faq4" className="accordion-collapse collapse" data-bs-parent="#faqAccordion">
                    <div className="accordion-body text-muted small">
                      No. Once paired, your token is securely stored in <code>~/.mld_agent.properties</code> on your machine and persists across reboots.
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
