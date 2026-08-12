import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api';

export default function MobileAgent() {
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [currentSessionCode, setCurrentSessionCode] = useState('');
  const [webcamActive, setWebcamActive] = useState(false);
  const [isFocused, setIsFocused] = useState(true);
  
  const videoRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('uuid_token');
    if (!token) {
      navigate('/');
      return;
    }

    const handleVisibilityChange = () => {
      setIsFocused(document.visibilityState === 'visible');
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    const runTelemetry = async () => {
      try {
        const sessionRes = await api.get('/active-session');
        if (sessionRes && sessionRes.active && sessionRes.sessionCode) {
          setIsMonitoring(true);
          setCurrentSessionCode(sessionRes.sessionCode);
          
          const isVisible = document.visibilityState === 'visible';
          const windowTitle = isVisible ? 'Google Meet (Mobile Web Agent)' : 'Unknown Background App';
          
          await api.post('/track', {
            sessionCode: sessionRes.sessionCode,
            window: windowTitle,
            webcam: webcamActive,
            idle: isVisible ? 0 : 999 
          });
        } else {
          setIsMonitoring(false);
          setCurrentSessionCode('');
        }
      } catch (error) {
        console.error('Agent loop error', error);
      }
    };

    const loopInterval = setInterval(runTelemetry, 5000);
    runTelemetry();

    return () => {
      clearInterval(loopInterval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [navigate, webcamActive]);

  const enableCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setWebcamActive(true);
    } catch (err) {
      alert('Camera access denied. Webcam tracking will be reported as OFF.');
    }
  };

  return (
    <div className="bg-dark text-white d-flex align-items-center justify-content-center min-vh-100" style={{ background: 'radial-gradient(circle at center, #1a1a2e 0%, #0f0f1a 100%)' }}>
        <div className="container text-center px-4">
            <div className="mb-4">
                <i className="bi bi-phone-vibrate text-primary" style={{ fontSize: '4rem', filter: 'drop-shadow(0 0 15px rgba(0,255,136,0.5))' }}></i>
            </div>
            
            <h2 className="fw-bold mb-2">Mobile Web Agent</h2>
            <p className="text-muted small mb-4">Your phone browser is now acting as the telemetry agent.</p>
            
            <div className="card bg-dark border-secondary shadow-lg rounded-4 overflow-hidden mb-4">
                <div className="card-body p-4 position-relative">
                    <div className="position-absolute top-0 end-0 p-3">
                        {isMonitoring ? (
                            <span className="badge bg-success text-light pulse-online">
                                <i className="bi bi-record-circle-fill small me-1"></i> RECORDING
                            </span>
                        ) : (
                            <span className="badge bg-secondary text-light pulse-offline">
                                <i className="bi bi-circle-fill small me-1"></i> STANDBY
                            </span>
                        )}
                    </div>
                    
                    <h5 className="fw-semibold text-start mb-3"><i className="bi bi-activity me-2 text-primary"></i>Telemetry Status</h5>
                    
                    <div className="d-flex justify-content-between align-items-center mb-2 border-bottom border-secondary pb-2">
                        <span className="text-muted small">Target Session</span>
                        <span className="fw-bold">{currentSessionCode || 'Waiting...'}</span>
                    </div>
                    
                    <div className="d-flex justify-content-between align-items-center mb-2 border-bottom border-secondary pb-2">
                        <span className="text-muted small">Browser Focus</span>
                        {isMonitoring ? (
                            isFocused ? (
                                <span className="fw-bold text-success">FOCUSED</span>
                            ) : (
                                <span className="fw-bold text-danger">BACKGROUND</span>
                            )
                        ) : (
                            <span className="fw-bold text-muted">-</span>
                        )}
                    </div>
                    
                    <div className="d-flex justify-content-between align-items-center">
                        <span className="text-muted small">Camera Status</span>
                        {webcamActive ? (
                            <span className="fw-bold text-success">ACTIVE</span>
                        ) : (
                            <span className="fw-bold text-danger">DISABLED</span>
                        )}
                    </div>
                </div>
                <div className="card-footer bg-black bg-opacity-25 border-top border-secondary text-start py-3">
                    <p className="mb-0 text-warning small fw-semibold">
                        <i className="bi bi-exclamation-triangle-fill me-1"></i> CRITICAL WARNING:
                    </p>
                    <p className="text-muted small mb-0 mt-1" style={{ fontSize: '0.8rem' }}>
                        Do not close this tab or switch to another app during an active session. Doing so will immediately drop your engagement score to 0%.
                    </p>
                </div>
            </div>
            
            {!webcamActive && (
                <button onClick={enableCamera} className="btn btn-outline-primary rounded-pill px-4 mb-3">
                    <i className="bi bi-camera-video me-2"></i> Enable Camera Tracking
                </button>
            )}
            
            <div>
                <Link to="/employee-dashboard" className="text-muted small text-decoration-none">
                    <i className="bi bi-arrow-left me-1"></i> Exit Web Agent
                </Link>
            </div>
        </div>

        <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }}></video>
    </div>
  );
}
