import { Link, useLocation, useNavigate } from 'react-router-dom';

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('uuid_token');
    localStorage.removeItem('user_role');
    navigate('/');
  };

  return (
    <nav className="sidebar d-none d-md-flex flex-column p-3">
        <Link to="/manager-dashboard" className="d-flex align-items-center mb-4 text-dark text-decoration-none px-3">
            <i className="bi bi-radar text-primary fs-3 me-2"></i>
            <span className="fs-5 fw-bold">MLD Admin</span>
        </Link>
        <hr className="border-secondary mt-0" />
        <ul className="nav flex-column mb-auto">
            <li className="nav-item">
                <Link to="/manager-dashboard" className={`nav-link ${location.pathname === '/manager-dashboard' ? 'active' : ''}`}>
                    <i className="bi bi-grid-1x2"></i> Dashboard
                </Link>
            </li>
            <li className="nav-item">
                <Link to="/analytics" className={`nav-link ${location.pathname === '/analytics' ? 'active' : ''}`}>
                    <i className="bi bi-graph-up"></i> Analytics
                </Link>
            </li>
            <li className="nav-item">
                <Link to="/reports" className={`nav-link ${location.pathname === '/reports' ? 'active' : ''}`}>
                    <i className="bi bi-file-earmark-text"></i> Reports
                </Link>
            </li>
            <li className="nav-item">
                <Link to="/alerts" className={`nav-link ${location.pathname === '/alerts' ? 'active' : ''}`}>
                    <i className="bi bi-bell"></i> Alerts
                </Link>
            </li>

        </ul>
        <hr className="border-secondary" />
        <div className="px-3 py-2">
            <button onClick={handleLogout} className="btn btn-outline-danger w-100">
                <i className="bi bi-box-arrow-left me-2"></i>Logout
            </button>
        </div>
    </nav>
  );
}
