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
                      <div className="col-md-4">
                          <label className="form-label text-muted small">Search Employee</label>
                          <div className="input-group">
                              <span className="input-group-text bg-transparent border-secondary text-muted"><i className="bi bi-search"></i></span>
                              <input type="text" className="form-control" placeholder="Search by name..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                          </div>
                      </div>
                      <div className="col-md-3">
                          <label className="form-label text-muted small">Export Month</label>
                          <input type="month" className="form-control" value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)} />
                      </div>
                      <div className="col-md-3">
                          <label className="form-label text-muted small">Department / Role</label>
                          <select className="form-select">
                              <option value="">All Roles</option>
                              <option value="developer">Developer</option>
                              <option value="designer">Designer</option>
                          </select>
                      </div>
                      <div className="col-md-2 d-flex align-items-end">
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
                                  <th scope="col" className="ps-4">Name</th>
                                  <th scope="col">Role</th>
                                  <th scope="col">Avg Score</th>
                                  <th scope="col">General Status</th>
                                  <th scope="col">Date & Time</th>
                                  <th scope="col">Actions</th>
                              </tr>
                          </thead>
                          <tbody>
                              {loading && data.length === 0 ? (
                                  <tr>
                                      <td colSpan="6" className="text-center py-4 text-muted">
                                          <div className="spinner-border spinner-border-sm text-primary me-2" role="status"></div>
                                          Loading reports...
                                      </td>
                                  </tr>
                              ) : filteredData.length === 0 ? (
                                  <tr>
                                      <td colSpan="6" className="text-center py-4 text-muted">No records found.</td>
                                  </tr>
                              ) : (
                                  filteredData.map((emp, i) => {
                                      const score = emp.score !== undefined ? (emp.score <= 1 ? Math.round(emp.score * 100) : emp.score) : 0;
                                      let statusBadge = score < 50 ? 'danger' : 'success';
                                      let statusText = score < 50 ? 'Distracted' : 'Engaged';
                                      
                                      return (
                                          <tr key={i}>
                                              <td className="ps-4 fw-medium">{emp.name}</td>
                                              <td className="text-muted text-capitalize">{emp.role}</td>
                                              <td><span className="fw-bold">{score}%</span></td>
                                              <td><span className={`badge badge-soft-${statusBadge} px-3 py-2 rounded-pill`}>{statusText}</span></td>
                                              <td className="text-secondary small">{(emp.joinTime || emp.timestamp) ? new Date(emp.joinTime || emp.timestamp).toLocaleString() : new Date().toLocaleString()}</td>
                                              <td>
                                                  <button className="btn btn-sm btn-outline-primary" onClick={() => openTimeline(emp.timeline)}>View Timeline</button>
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

                                            return (
                                                <tr key={index}>
                                                    <td className="ps-4">{timeSec}s</td>
                                                    <td><small className="text-secondary">{winName}</small></td>
                                                    <td>
                                                        {isMeetingOrWorkspace ? (
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
