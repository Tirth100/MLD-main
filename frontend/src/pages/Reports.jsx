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
  const [selectedReport, setSelectedReport] = useState(null);
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

  const getEmpScore = (emp) => {
    if (!emp) return 0;
    if (typeof emp.focusedChecks === 'number' && typeof emp.totalChecks === 'number' && emp.totalChecks > 0) {
      return Math.min(100, Math.max(0, Math.round((emp.focusedChecks / emp.totalChecks) * 100)));
    }
    const raw = Number(emp.score !== undefined && emp.score !== null ? emp.score : emp.attentionScore);
    if (isNaN(raw)) return 0;
    if (raw > 0 && raw <= 1) return Math.min(100, Math.max(0, Math.round(raw * 100)));
    return Math.min(100, Math.max(0, Math.round(raw)));
  };

  const formatDuration = (seconds) => {
    if (!seconds || isNaN(seconds) || seconds <= 0) return '0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const getEmpDuration = (emp) => {
    if (!emp) return 0;
    if (emp.durationSeconds !== undefined && Number(emp.durationSeconds) > 0) return Number(emp.durationSeconds);
    if (emp.totalChecks !== undefined && Number(emp.totalChecks) > 0) return Number(emp.totalChecks) * 10;
    if (emp.duration !== undefined && Number(emp.duration) > 0) return Number(emp.duration);
    return 0;
  };



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

  const openTimeline = (timeline, emp = null) => {
    setTimelineData(timeline || []);
    setSelectedReport(emp);
    setShowModal(true);
  };

  const exportTimelineToExcel = async () => {
    if (!timelineData || timelineData.length === 0) {
      alert("No timeline activity to export.");
      return;
    }
    const participantName = selectedReport?.name || 'Participant';
    const scorePct = getEmpScore(selectedReport);
    const sessionTime = (selectedReport?.joinTime || selectedReport?.timestamp)
      ? new Date(selectedReport.joinTime || selectedReport.timestamp).toLocaleString()
      : new Date().toLocaleString();

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Timeline Activity');

    worksheet.mergeCells('A1:C1');
    worksheet.getCell('A1').value = 'Meeting Leech Detector — Session Timeline Activity';
    worksheet.getCell('A1').font = { size: 14, bold: true, color: { argb: 'FF1E293B' } };
    worksheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };

    worksheet.getCell('A2').value = `Participant: ${participantName}`;
    worksheet.getCell('B2').value = `Avg Score: ${scorePct}%`;
    worksheet.getCell('C2').value = `Date & Time: ${sessionTime}`;
    ['A2', 'B2', 'C2'].forEach(ref => {
      worksheet.getCell(ref).font = { italic: true, color: { argb: 'FF475569' } };
    });

    worksheet.addRow([]);

    const headerRow = worksheet.addRow(['Time (s)', 'Active Window / Application', 'Classification']);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell(cell => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2563EB' }
      };
      cell.alignment = { vertical: 'middle' };
    });

    worksheet.columns = [
      { width: 14 },
      { width: 55 },
      { width: 24 }
    ];

    timelineData.forEach((check, index) => {
      const timeSec = `${index * 10}s`;
      const winName = check.window || "Desktop Workspace";
      const lowerWin = winName.toLowerCase();
      const isFocused = check.focused;
      const isAi = check.aiDetected || lowerWin.includes('[ai detected') || lowerWin.includes('[ai tool') || lowerWin.includes('capture evasion');
      const classification = isAi ? 'AI Assistance Detected' : (isFocused ? 'Focused' : 'Distracted');

      const row = worksheet.addRow([timeSec, winName, classification]);
      const bgColor = isAi ? 'FFFFE4E6' : (isFocused ? 'FFDCFCE7' : 'FFFEE2E2');
      const textColor = isAi ? 'FF991B1B' : (isFocused ? 'FF166534' : 'FF991B1B');

      row.getCell(3).font = { bold: true, color: { argb: textColor } };
      row.getCell(3).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: bgColor }
      };
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const safeName = participantName.replace(/[^a-zA-Z0-9_-]/g, '_');
    saveAs(blob, `${safeName}_Timeline_Activity.xlsx`);
  };

  const exportTimelineToCsv = () => {
    if (!timelineData || timelineData.length === 0) {
      alert("No timeline activity to export.");
      return;
    }
    const participantName = selectedReport?.name || 'Participant';
    const csvRows = [['Time (s)', 'Active Window', 'Classification']];

    timelineData.forEach((check, index) => {
      const timeSec = `${index * 10}s`;
      const winName = (check.window || "Desktop Workspace").replace(/"/g, '""');
      const lowerWin = winName.toLowerCase();
      const isFocused = check.focused;
      const isAi = check.aiDetected || lowerWin.includes('[ai detected') || lowerWin.includes('[ai tool') || lowerWin.includes('capture evasion');
      const classification = isAi ? 'AI Assistance Detected' : (isFocused ? 'Focused' : 'Distracted');
      csvRows.push([timeSec, `"${winName}"`, classification]);
    });

    const csvContent = csvRows.map(e => e.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const safeName = participantName.replace(/[^a-zA-Z0-9_-]/g, '_');
    saveAs(blob, `${safeName}_Timeline_Activity.csv`);
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
        { header: 'Participant', key: 'name', width: 22 },
        { header: 'Session Code', key: 'sessionCode', width: 16 },
        { header: 'Duration', key: 'duration', width: 14 },
        { header: 'Score (%)', key: 'score', width: 14 },
        { header: 'Status', key: 'status', width: 18 },
        { header: 'Date & Time', key: 'dateTime', width: 25 },
      ];

      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };

      groupedByDay[day].forEach(emp => {
        const score = getEmpScore(emp);
        const statusText = emp.status && emp.status.trim() !== ''
            ? emp.status
            : (score > 75 ? 'Engaged' : (score >= 50 ? 'Focused' : 'Low Engagement'));
        const dur = formatDuration(getEmpDuration(emp));
        
        const row = worksheet.addRow({
          name: emp.name,
          sessionCode: emp.sessionCode || '—',
          duration: dur,
          score: `${score}%`,
          status: statusText,
          dateTime: emp.dateObj.toLocaleString()
        });

        const fillColor = score > 75 ? 'FFDCFCE7' : (score >= 50 ? 'FFFEF3C7' : 'FFFEE2E2');
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
                                  <th scope="col">Session</th>
                                  <th scope="col">Duration</th>
                                  <th scope="col">Attention Score</th>
                                  <th scope="col">Status</th>
                                  <th scope="col">Date & Time</th>
                                  <th scope="col">Actions</th>
                              </tr>
                          </thead>
                          <tbody>
                              {loading && data.length === 0 ? (
                                  <tr>
                                      <td colSpan="7" className="text-center py-4 text-muted">
                                          <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                          Loading reports...
                                      </td>
                                  </tr>
                              ) : filteredData.length === 0 ? (
                                  <tr>
                                      <td colSpan="7" className="text-center py-4 text-muted">No records found.</td>
                                  </tr>
                              ) : (
                                  filteredData.map((emp, i) => {
                                      const score = getEmpScore(emp);
                                      const statusBadge = score > 75 ? 'success' : (score >= 50 ? 'warning' : 'danger');
                                      const statusText = emp.status && emp.status.trim() !== '' 
                                          ? emp.status 
                                          : (score > 75 ? 'Engaged' : (score >= 50 ? 'Focused' : 'Low Engagement'));
                                      const dur = formatDuration(getEmpDuration(emp));
                                      
                                      return (
                                          <tr key={i}>
                                              <td className="ps-4 fw-medium text-dark">{emp.name}</td>
                                              <td>
                                                  <span className="badge bg-light text-secondary border font-monospace px-2.5 py-1">
                                                      {emp.sessionCode || '—'}
                                                  </span>
                                              </td>
                                              <td className="text-secondary small">{dur}</td>
                                              <td>
                                                  <div className="d-flex align-items-center gap-2">
                                                      <span className={`fw-bold text-${statusBadge}`} style={{ minWidth: '40px' }}>
                                                          {score}%
                                                      </span>
                                                      <div className="progress flex-grow-1" style={{ height: '6px', width: '60px', backgroundColor: '#e2e8f0' }}>
                                                          <div className={`progress-bar bg-${statusBadge}`} style={{ width: `${score}%` }}></div>
                                                      </div>
                                                  </div>
                                              </td>
                                              <td><span className={`badge badge-soft-${statusBadge} px-3 py-1.5 rounded-pill`}>{statusText}</span></td>
                                              <td className="text-secondary small">{(emp.joinTime || emp.timestamp) ? new Date(emp.joinTime || emp.timestamp).toLocaleString() : new Date().toLocaleString()}</td>
                                              <td className="text-nowrap">
                                                   <button className="btn btn-sm btn-outline-primary me-2 shadow-xs" onClick={() => openTimeline(emp.timeline, emp)}>
                                                       <i className="bi bi-clock-history me-1"></i>View Timeline
                                                   </button>
                                                   {isManager && !emp.isLive && (
                                                       <button 
                                                           className="btn btn-sm btn-outline-danger shadow-xs" 
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
                    <div className="modal-header border-secondary d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-2">
                            <i className="bi bi-clock-history text-primary fs-5"></i>
                            <h5 className="modal-title mb-0">Session Timeline Activity</h5>
                            {selectedReport?.name && (
                                <span className="badge bg-light text-dark border ms-2">
                                    {selectedReport.name}
                                </span>
                            )}
                        </div>
                        <div className="d-flex align-items-center gap-2">
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-success d-flex align-items-center gap-1 shadow-sm"
                                onClick={exportTimelineToExcel}
                                disabled={!timelineData || timelineData.length === 0}
                                title="Export Timeline to Excel"
                            >
                                <i className="bi bi-file-earmark-excel me-1"></i>Export
                            </button>
                            <button type="button" className="btn-close" onClick={() => setShowModal(false)}></button>
                        </div>
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
                    <div className="modal-footer border-secondary d-flex justify-content-between align-items-center">
                        <div className="d-flex gap-2">
                            <button
                                type="button"
                                className="btn btn-sm btn-success d-flex align-items-center gap-1 shadow-sm"
                                onClick={exportTimelineToExcel}
                                disabled={!timelineData || timelineData.length === 0}
                            >
                                <i className="bi bi-file-earmark-excel-fill me-1"></i>Export Excel (.xlsx)
                            </button>
                            <button
                                type="button"
                                className="btn btn-sm btn-outline-primary d-flex align-items-center gap-1 shadow-sm"
                                onClick={exportTimelineToCsv}
                                disabled={!timelineData || timelineData.length === 0}
                            >
                                <i className="bi bi-filetype-csv me-1"></i>Export CSV
                            </button>
                        </div>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowModal(false)}>Close</button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </>
  );
}
