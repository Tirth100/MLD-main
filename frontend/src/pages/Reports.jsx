import { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import { api } from '../api';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

export default function Reports() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [timelineData, setTimelineData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingKey, setDeletingKey] = useState(null);
  const userRole = localStorage.getItem('user_role');
  const isManager = userRole === 'MANAGER' || userRole === 'ADMIN';
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  });

  const fetchReports = async () => {
    try {
      const result = await api.get('/engagement');
      if (Array.isArray(result)) {
        setData(result);
      }
    } catch (error) {
      console.error("Failed to load reports", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, []);


  const handleDeleteReport = async (emp) => {
    const reportIdentifier = emp.name || 'this participant';
    const timeDisplay = (emp.joinTime || emp.timestamp) ? new Date(emp.joinTime || emp.timestamp).toLocaleString() : '';
    if (!window.confirm(`Are you sure you want to delete the report for "${reportIdentifier}" (${timeDisplay})? This action cannot be undone.`)) {
      return;
    }

    const key = emp.id ? `id_${emp.id}` : `ts_${emp.timestamp}`;
    try {
      setDeletingKey(key);
      const params = new URLSearchParams();
      if (emp.id) params.append('id', emp.id);
      if (emp.timestamp) params.append('timestamp', emp.timestamp);
      if (emp.sessionCode) params.append('sessionCode', emp.sessionCode);

      const res = await api.delete(`/engagement?${params.toString()}`);
      if (res && res.success) {
        setData(prev => prev.filter(item => {
          if (emp.id && item.id) return item.id !== emp.id;
          return item.timestamp !== emp.timestamp;
        }));
      } else {
        alert(res?.message || 'Failed to delete report.');
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete report. Please try again.');
    } finally {
      setDeletingKey(null);
    }
  };

  const openTimeline = (timeline) => {
    setTimelineData(timeline || []);
    setShowModal(true);
  };

  const filteredData = data.filter(emp => emp.name.toLowerCase().includes(searchTerm.toLowerCase()));

  const handleExport = async () => {
    if (filteredData.length === 0) {
      alert("No data to export.");
      return;
    }

    const [year, month] = selectedMonth.split('-');
    const dataForMonth = filteredData.filter(emp => {
      const timeStr = emp.joinTime || emp.timestamp || new Date().toISOString();
      const date = new Date(timeStr);
      return date.getFullYear() === parseInt(year) && (date.getMonth() + 1) === parseInt(month);
    });

    if (dataForMonth.length === 0) {
      alert(`No data found for ${selectedMonth}`);
      return;
    }

    const groupedByDay = {};
    dataForMonth.forEach(emp => {
      const timeStr = emp.joinTime || emp.timestamp || new Date().toISOString();
      const date = new Date(timeStr);
      const day = date.getDate();
      if (!groupedByDay[day]) groupedByDay[day] = [];
      groupedByDay[day].push({ ...emp, dateObj: date });
    });

    const workbook = new ExcelJS.Workbook();
    const monthName = new Date(parseInt(year), parseInt(month) - 1).toLocaleString('default', { month: 'short' });

    Object.keys(groupedByDay).sort((a, b) => a - b).forEach(day => {
      const sheetName = `${monthName} ${day}`;
      const worksheet = workbook.addWorksheet(sheetName);

      worksheet.columns = [
        { header: 'Name', key: 'name', width: 20 },
        { header: 'Role', key: 'role', width: 15 },
        { header: 'Score (%)', key: 'score', width: 12 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Date & Time', key: 'dateTime', width: 25 },
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      groupedByDay[day].forEach(emp => {
        const score = emp.score !== undefined ? (emp.score <= 1 ? Math.round(emp.score * 100) : emp.score) : 0;
        const statusText = score < 50 ? 'Distracted' : 'Engaged';
        
        const row = worksheet.addRow({
          name: emp.name,
          role: emp.role,
          score: score,
          status: statusText,
          dateTime: emp.dateObj.toLocaleString()
        });

        const fillColor = statusText === 'Distracted' ? 'FFFFCCCC' : 'FFCCFFCC';
        row.eachCell((cell) => {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: fillColor }
          };
        });
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${monthName}_Engagement_Score.xlsx`);
  };

  return (
    <>
      <Sidebar />
      <main className="main-content">
          <header className="top-navbar mb-4 rounded-3 glass-card">
              <div className="d-flex align-items-center">
                  <h4 className="mb-0 fw-bold">Engagement Reports</h4>
              </div>
          </header>

          <div className="card glass-card mb-4">
              <div className="card-body">
                  <div className="row align-items-center g-3">
                      <div className="col-md-6">
                          <label className="form-label text-muted small">Search Participant</label>
                          <div className="input-group">
                              <span className="input-group-text bg-transparent border-secondary text-muted"><i className="bi bi-search"></i></span>
                              <input type="text" className="form-control" placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                          </div>
                      </div>
                      <div className="col-md-3">
                          <label className="form-label text-muted small">Export Month</label>
                          <input type="month" className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                      </div>
                      <div className="col-md-3 d-flex align-items-end">
                          <button onClick={handleExport} className="btn btn-primary w-100"><i className="bi bi-file-earmark-spreadsheet me-2"></i>Export Report</button>
                      </div>
                  </div>
              </div>
          </div>

          <div className="card glass-card">
              <div className="card-body p-0">
                  <div className="table-responsive">
                      <table className="table table-hover align-middle mb-0">
                          <thead className="bg-transparent">
                              <tr>
                                  <th scope="col" className="ps-4">Participant</th>
                                  <th scope="col">Avg Score</th>
                                  <th scope="col">General Status</th>
                                  <th scope="col">Date & Time</th>
                                  <th scope="col">Actions</th>
                              </tr>
                          </thead>
                          <tbody>
                              {loading && data.length === 0 ? (
                                  <tr>
                                      <td colSpan="5" className="text-center py-4 text-muted">
                                          <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                          Loading reports...
                                      </td>
                                  </tr>
                              ) : filteredData.length === 0 ? (
                                  <tr>
                                      <td colSpan="5" className="text-center py-4 text-muted">No records found.</td>
                                  </tr>
                              ) : (
                                  filteredData.map((emp, i) => {
                                      const rawScore = Number(emp.score);
                                      const score = !isNaN(rawScore) ? (rawScore <= 1 && rawScore > 0 ? Math.round(rawScore * 100) : Math.round(rawScore)) : 0;
                                      const statusBadge = score > 75 ? 'success' : (score >= 50 ? 'warning' : 'danger');
                                      const statusText = emp.status && emp.status.trim() !== '' 
                                          ? emp.status 
                                          : (score > 75 ? 'Engaged' : (score >= 50 ? 'Focused' : 'Low Engagement'));
                                      
                                      return (
                                          <tr key={i}>
                                              <td className="ps-4 fw-medium">{emp.name}</td>
                                              <td><span className={`fw-bold text-${statusBadge}`}>{score}%</span></td>
                                              <td><span className={`badge badge-soft-${statusBadge} px-3 py-2 rounded-pill`}>{statusText}</span></td>
                                              <td className="text-secondary small">{(emp.joinTime || emp.timestamp) ? new Date(emp.joinTime || emp.timestamp).toLocaleString() : new Date().toLocaleString()}</td>
                                              <td className="text-nowrap">
                                                   <button className="btn btn-sm btn-outline-primary me-2" onClick={() => openTimeline(emp.timeline)}>
                                                       <i className="bi bi-clock-history me-1"></i>View Timeline
                                                   </button>
                                                   {isManager && !emp.isLive && (
                                                       <button 
                                                           className="btn btn-sm btn-outline-danger" 
                                                           title="Delete this report"
                                                           disabled={deletingKey === (emp.id ? `id_${emp.id}` : `ts_${emp.timestamp}`)}
                                                           onClick={() => handleDeleteReport(emp)}
                                                       >
                                                           {deletingKey === (emp.id ? `id_${emp.id}` : `ts_${emp.timestamp}`) ? (
                                                               <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                                           ) : (
                                                               <i className="bi bi-trash"></i>
                                                           )}
                                                       </button>
                                                   )}
                                               </td>
                                          </tr>
                                      );
                                  })
                              )}
                          </tbody>
                      </table>
                  </div>
              </div>
          </div>
      </main>

      {/* Timeline Modal */}
      {showModal && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }} tabIndex="-1">
            <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div className="modal-content bg-white border-secondary">
                    <div className="modal-header border-secondary">
                        <h5 className="modal-title">Session Timeline Activity</h5>
                        <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                    </div>
                    <div className="modal-body p-0">
                        <div className="table-responsive">
                            <table className="table table-hover mb-0">
                                <thead>
                                    <tr>
                                        <th className="ps-4">Time (s)</th>
                                        <th>Active Window</th>
                                        <th>Classification</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timelineData.length === 0 ? (
                                        <tr>
                                            <td colSpan="3" className="text-center py-4 text-muted">No timeline activity stored.</td>
                                        </tr>
                                    ) : (
                                        timelineData.map((check, index) => {
                                            const timeSec = index * 10;
                                            const winName = check.window || "Desktop Workspace";
                                            const lowerWin = winName.toLowerCase();
                                            const isMeetingOrWorkspace = check.focused;
                                            const isAi = check.aiDetected || lowerWin.includes('[ai detected') || lowerWin.includes('[ai tool') || lowerWin.includes('capture evasion');

                                            return (
                                                <tr key={index} className={isAi ? "table-danger bg-danger bg-opacity-10" : ""}>
                                                    <td className="ps-4 fw-bold">{timeSec}s</td>
                                                    <td>
                                                        <small className={isAi ? "text-danger fw-semibold" : "text-secondary"}>
                                                            {isAi && <i className="bi bi-robot me-1 text-danger"></i>}
                                                            {winName}
                                                        </small>
                                                    </td>
                                                    <td>
                                                        {isAi ? (
                                                            <span className="badge bg-danger rounded-pill px-3 py-1">
                                                                <i className="bi bi-exclamation-triangle-fill me-1"></i>AI Detected
                                                            </span>
                                                        ) : isMeetingOrWorkspace ? (
                                                            <span className="text-success fw-bold">Focused</span>
                                                        ) : (
                                                            <span className="text-danger">Distracted</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div className="modal-footer border-secondary">
                        <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Close</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </>
  );
}
