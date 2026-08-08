/**
 * main.js
 * Frontend logic, DOM manipulation, and Chart.js initialization
 */

document.addEventListener('DOMContentLoaded', () => {

    // --- Google Auth Callbacks ---
    window.handleGoogleLogin = async (response) => {
        try {
            const res = await window.api.post('/google-login', { token: response.credential });
            if (res.success) {
                localStorage.setItem('uuid_token', res.token);
                localStorage.setItem('username', res.name);
                if (res.role === 'ADMIN' || res.role === 'manager') {
                    window.location.href = 'pages/manager-dashboard.html';
                } else {
                    window.location.href = 'pages/employee-dashboard.html';
                }
            } else {
                alert(res.message || 'Login failed or user not found. Please register first.');
            }
        } catch (err) {
            alert('Login failed. Ensure backend server is running.');
        }
    };

    window.handleGoogleOrgSignup = async (response) => {
        const orgName = document.getElementById('orgName').value;
        if (!orgName) {
            alert('Please enter an Organization Name before signing up.');
            return;
        }
        try {
            const res = await window.api.post('/google-signup-org', { 
                token: response.credential, 
                orgName: orgName 
            });
            if (res.success) {
                document.getElementById('orgSignupForm').classList.add('d-none');
                const successDiv = document.getElementById('orgSuccessMessage');
                if (successDiv) successDiv.classList.remove('d-none');
                const codeEl = document.getElementById('displayOrgCode');
                if (codeEl) codeEl.innerText = res.orgCode;
            } else {
                alert(res.message || 'Organization registration failed.');
            }
        } catch (err) {
            alert('Signup network error.');
        }
    };

    window.handleGoogleEmpSignup = async (response) => {
        const orgCode = document.getElementById('orgCodeInput').value;
        if (!orgCode) {
            alert('Please enter an Organization Code before signing up.');
            return;
        }
        try {
            const res = await window.api.post('/google-signup-emp', { 
                token: response.credential, 
                orgCode: orgCode 
            });
            if (res.success) {
                alert('Successfully joined the organization! Redirecting to login...');
                window.location.href = 'index.html';
            } else {
                alert(res.message || 'Failed to join organization. Check the org code.');
            }
        } catch (err) {
            alert('Signup network error.');
        }
    };

    // --- Email & Password Auth Handlers ---
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const pass = document.getElementById('password').value;
            
            try {
                const response = await window.api.post('/login', { email: email, password: pass });
                if (response && response.success) {
                    localStorage.setItem('uuid_token', response.token);
                    localStorage.setItem('username', response.name);
                    localStorage.setItem('user_role', response.role);
                    if (response.role === 'ADMIN' || response.role === 'manager') {
                        window.location.href = 'pages/manager-dashboard.html';
                    } else {
                        window.location.href = 'pages/employee-dashboard.html';
                    }
                } else {
                    alert(response.message || 'Invalid email or password.');
                }
            } catch (err) {
                alert('Login failed. Ensure backend server is running.');
            }
        });
    }

    const orgSignupForm = document.getElementById('orgSignupForm');
    if (orgSignupForm) {
        orgSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const orgName = document.getElementById('orgName').value;
            const managerName = document.getElementById('managerName').value;
            const email = document.getElementById('orgEmail').value;
            const pass = document.getElementById('orgPassword').value;
            
            try {
                const response = await window.api.post('/signup-org', { orgName, managerName, email, password: pass });
                if (response && response.success) {
                    orgSignupForm.classList.add('d-none');
                    const divider = orgSignupForm.nextElementSibling;
                    if (divider && divider.classList.contains('my-3')) divider.classList.add('d-none');
                    const googleDiv = document.getElementById('g_id_onload');
                    if (googleDiv && googleDiv.nextElementSibling) googleDiv.nextElementSibling.classList.add('d-none');
                    
                    const successDiv = document.getElementById('orgSuccessMessage');
                    if (successDiv) successDiv.classList.remove('d-none');
                    const codeEl = document.getElementById('displayOrgCode');
                    if (codeEl) codeEl.innerText = response.orgCode;
                } else {
                    alert(response.message || 'Registration failed.');
                }
            } catch (err) {
                alert('Signup network error.');
            }
        });
    }

    const empSignupForm = document.getElementById('empSignupForm');
    if (empSignupForm) {
        empSignupForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const orgCode = document.getElementById('orgCodeInput').value;
            const empName = document.getElementById('empName').value;
            const email = document.getElementById('empEmail').value;
            const pass = document.getElementById('empPassword').value;
            
            try {
                const response = await window.api.post('/signup-emp', { orgCode, name: empName, email, password: pass });
                if (response && response.success) {
                    alert('Successfully joined organization! Redirecting to login...');
                    window.location.href = 'index.html';
                } else {
                    alert(response.message || 'Failed to join organization. Check the org code.');
                }
            } catch (err) {
                alert('Signup network error.');
            }
        });
    }

    // --- Sidebar active state toggle ---
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        if(currentPath.includes(link.getAttribute('href'))) {
            link.classList.add('active');
        }
    });

    // --- Load Data Routines ---
    if (document.getElementById('managerDashboard') || document.getElementById('employeeDashboard')) {
        loadUserProfile();
    }
    
    if (document.getElementById('managerDashboard')) {
        loadManagerDashboard();
        setInterval(loadManagerDashboard, 2500);
    }
    if (document.getElementById('analyticsPage')) {
        loadAnalytics();
        setInterval(loadAnalytics, 2500);
    }
    if (document.getElementById('reportsPage')) {
        loadReports();
        setInterval(loadReports, 3000);
    }
    if (document.getElementById('alertsPage')) {
        loadAlerts();
        setInterval(loadAlerts, 2500);
    }
    if (document.getElementById('employeeDashboard')) {
        loadEmployeeDashboard();
        setInterval(loadEmployeeDashboard, 2500);
    }
    
    // --- Manager Modals & Notifications ---
    if (document.getElementById('profileDropdown')) {
        initManagerModals();
        setInterval(loadManagerNotifications, 10000);
        loadManagerNotifications();
    }

    // --- Stop Session Button ---
    const stopSessionBtn = document.getElementById('stopSessionBtn');
    if (stopSessionBtn) {
        stopSessionBtn.addEventListener('click', async () => {
            if(confirm("Are you sure you want to officially end the current monitoring session for all participants?")) {
                try {
                    await window.api.get('/stop');
                    localStorage.removeItem('active_session_code');
                    if (autoTrackerInterval) {
                        clearInterval(autoTrackerInterval);
                        autoTrackerInterval = null;
                    }
                    
                    const codeDisplay = document.getElementById('displaySessionCode');
                    const startBtn = document.getElementById('btnGenerateSession');
                    if (stopSessionBtn) stopSessionBtn.classList.add('d-none');
                    if (codeDisplay) codeDisplay.classList.add('d-none');
                    if (startBtn) startBtn.classList.remove('d-none');

                    alert("Session successfully terminated for all connected employees. The final report has been saved.");
                    if(document.getElementById('reportsPage')) loadReports();
                    if(document.getElementById('managerDashboard')) loadManagerDashboard();
                } catch(e) {
                    alert("Error communicating with backend server.");
                }
            }
        });
    }

    // --- User Activity & Idle Tracking ---
    let lastActivityTimestamp = Date.now();
    ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'].forEach(evt => {
        window.addEventListener(evt, () => {
            lastActivityTimestamp = Date.now();
        }, { passive: true });
    });

    function getClientIdleSeconds() {
        return Math.floor((Date.now() - lastActivityTimestamp) / 1000);
    }

    // --- Automatic Background Session Tracker ---
    let autoTrackerInterval = null;

    function startAutomaticTracking(sessionCode, uuid) {
        if (autoTrackerInterval) clearInterval(autoTrackerInterval);
        
        sendTrackingTick(sessionCode, uuid);

        autoTrackerInterval = setInterval(() => {
            sendTrackingTick(sessionCode, uuid);
        }, 5000);
    }

    async function sendTrackingTick(sessionCode, uuid) {
        const isFocused = !document.hidden && document.hasFocus();
        const activeWindow = isFocused ? (document.title || "Meeting Workspace") : "Background / Distracted Window";
        const idleSecs = getClientIdleSeconds();
        
        try {
            const res = await window.api.post('/track', {
                uuid: uuid,
                sessionCode: sessionCode,
                window: activeWindow,
                webcam: true,
                idle: idleSecs
            });

            if (res && res.active === false) {
                localStorage.removeItem('active_session_code');
                if (autoTrackerInterval) {
                    clearInterval(autoTrackerInterval);
                    autoTrackerInterval = null;
                }
                const statusEl = document.getElementById('meetingStatus');
                if (statusEl) {
                    statusEl.textContent = "Session Terminated by Manager";
                    statusEl.className = "text-danger fw-bold";
                }
            }
        } catch(e) {
            console.warn("Auto tracking tick failed:", e.message);
        }
    }

    // --- Start Session Button (Manager) ---
    const btnGenerateSession = document.getElementById('btnGenerateSession');
    if (btnGenerateSession) {
        btnGenerateSession.addEventListener('click', async () => {
            try {
                const response = await window.api.post('/start');
                if (response.success) {
                    localStorage.setItem('active_session_code', response.sessionCode);
                    const codeDisplay = document.getElementById('displaySessionCode');
                    const codeValue = document.getElementById('sessionCodeValue');
                    const stopBtn = document.getElementById('stopSessionBtn');
                    
                    if (codeDisplay && codeValue) {
                        codeValue.textContent = response.sessionCode;
                        codeDisplay.classList.remove('d-none');
                    }
                    if (btnGenerateSession) btnGenerateSession.classList.add('d-none');
                    if (stopBtn) stopBtn.classList.remove('d-none');

                    const uuid = localStorage.getItem('uuid_token') || 'MANAGER_UUID';
                    startAutomaticTracking(response.sessionCode, uuid);
                } else {
                    alert("Failed to start session.");
                }
            } catch(e) {
                alert("Error starting backend session. Ensure server is running.");
            }
        });
    }

    // --- Join Session Button (Employee) ---
    const btnJoinSession = document.getElementById('btnJoinSession');
    if (btnJoinSession) {
        btnJoinSession.addEventListener('click', async () => {
            const sessionCodeInput = document.getElementById('sessionCodeInput');
            if (sessionCodeInput && sessionCodeInput.value.trim().length > 0) {
                const code = sessionCodeInput.value.trim().toUpperCase();
                const uuid = localStorage.getItem('uuid_token') || 'UNKNOWN_EMP';
                try {
                    const response = await window.api.post('/join', { sessionCode: code, uuid: uuid });
                    if (response.success) {
                        localStorage.setItem('active_session_code', code);
                        const statusEl = document.getElementById('meetingStatus');
                        if (statusEl) {
                            statusEl.textContent = "Monitoring Active for Session: " + code;
                            statusEl.classList.remove('text-muted');
                            statusEl.classList.add('text-success', 'fw-bold');
                        }
                        
                        // Activate Desktop Agent UI Card
                        const agentCard = document.getElementById('agentCardRow');
                        const joinedCodeText = document.getElementById('joinedCodeText');
                        const agentTokenDisplay = document.getElementById('agentTokenDisplay');
                        if (agentCard) agentCard.classList.remove('d-none');
                        if (joinedCodeText) joinedCodeText.textContent = code;
                        if (agentTokenDisplay) agentTokenDisplay.value = uuid;

                        startAutomaticTracking(code, uuid);
                    } else {
                        alert(response.message || "Invalid Session Code.");
                    }
                } catch(e) {
                    alert("Error joining session. Ensure server is running.");
                }
            } else {
                alert("Please enter a valid session code (e.g., MLD123).");
            }
        });
    }

    // --- Copy Token Button ---
    const btnCopyToken = document.getElementById('btnCopyToken');
    if (btnCopyToken) {
        btnCopyToken.addEventListener('click', () => {
            const agentTokenDisplay = document.getElementById('agentTokenDisplay');
            if (agentTokenDisplay && agentTokenDisplay.value) {
                navigator.clipboard.writeText(agentTokenDisplay.value).then(() => {
                    btnCopyToken.innerHTML = '<i class="bi bi-check2"></i> Copied!';
                    btnCopyToken.classList.replace('btn-outline-secondary', 'btn-success');
                    setTimeout(() => {
                        btnCopyToken.innerHTML = '<i class="bi bi-clipboard me-1"></i>Copy Token';
                        btnCopyToken.classList.replace('btn-success', 'btn-outline-secondary');
                    }, 2500);
                });
            }
        });
    }

    // --- Leave Session Button ---
    const btnLeaveSession = document.getElementById('btnLeaveSession');
    if (btnLeaveSession) {
        btnLeaveSession.addEventListener('click', async () => {
            if (confirm("Are you sure you want to leave the active session?")) {
                const uuid = localStorage.getItem('uuid_token') || '';
                try {
                    await window.api.post('/leave-session', { uuid: uuid });
                } catch(e) {}

                localStorage.removeItem('active_session_code');
                if (autoTrackerInterval) {
                    clearInterval(autoTrackerInterval);
                    autoTrackerInterval = null;
                }
                const agentCard = document.getElementById('agentCardRow');
                if (agentCard) agentCard.classList.add('d-none');
                const statusEl = document.getElementById('meetingStatus');
                if (statusEl) {
                    statusEl.textContent = "Session Left by User";
                    statusEl.className = "text-muted";
                }
            }
        });
    }


});

// Global tracking for Charts so they can be securely destroyed during live polling
let activeCharts = {};

// --- Specific Page Loaders ---

async function loadManagerDashboard() {
    try {
        const data = await window.api.get('/engagement');
        const tbody = document.getElementById('engagementTableBody');
        if(!tbody) return;
        
        // Calculate dynamic metrics
        const uniqueEmployees = new Set(data.map(emp => emp.name)).size;
        const totalMonitoredEl = document.getElementById('totalMonitoredMetricValue');
        if (totalMonitoredEl && totalMonitoredEl.textContent != uniqueEmployees) {
            totalMonitoredEl.textContent = uniqueEmployees;
        }

        const avgScore = data.length > 0 ? Math.round(data.reduce((acc, emp) => acc + emp.score, 0) / data.length) : 0;
        const avgEngagementEl = document.getElementById('avgEngagementMetricValue');
        if (avgEngagementEl && avgEngagementEl.textContent != `${avgScore}%`) {
            avgEngagementEl.textContent = `${avgScore}%`;
        }

        // Prepare reversed copy of data
        const listData = [...data].reverse();
        
        // Query backend server for live active session code
        let liveSessionCode = "";
        let isSessionActive = false;
        try {
            const activeSessionInfo = await window.api.get('/active-session');
            if (activeSessionInfo && activeSessionInfo.active) {
                isSessionActive = true;
                liveSessionCode = activeSessionInfo.sessionCode;
                localStorage.setItem('active_session_code', liveSessionCode);
            } else {
                localStorage.removeItem('active_session_code');
            }
        } catch (err) {
            const savedSessionCode = localStorage.getItem('active_session_code');
            isSessionActive = listData.some(emp => emp.isLive) || savedSessionCode != null;
            liveSessionCode = savedSessionCode || "";
        }
        
        const stopBtn = document.getElementById('stopSessionBtn');
        const startBtn = document.getElementById('btnGenerateSession');
        const codeDisplay = document.getElementById('displaySessionCode');
        const codeValue = document.getElementById('sessionCodeValue');
        
        if (isSessionActive) {
            if (stopBtn && stopBtn.classList.contains('d-none')) stopBtn.classList.remove('d-none');
            if (startBtn && !startBtn.classList.contains('d-none')) startBtn.classList.add('d-none');
            if (codeDisplay && codeValue && liveSessionCode) {
                if (codeValue.textContent !== liveSessionCode) codeValue.textContent = liveSessionCode;
                if (codeDisplay.classList.contains('d-none')) codeDisplay.classList.remove('d-none');
            }
        } else {
            if (stopBtn && !stopBtn.classList.contains('d-none')) stopBtn.classList.add('d-none');
            if (startBtn && startBtn.classList.contains('d-none')) startBtn.classList.remove('d-none');
            if (codeDisplay && !codeDisplay.classList.contains('d-none')) codeDisplay.classList.add('d-none');
        }
        
        const activeMeetingsEl = document.getElementById('activeMeetingsMetricValue');
        const expectedActive = isSessionActive ? "1" : "0";
        if (activeMeetingsEl && activeMeetingsEl.textContent !== expectedActive) {
            activeMeetingsEl.textContent = expectedActive;
        }

        let newRowsHtml = '';
        listData.forEach(emp => {
            const st = (emp.status || '').toLowerCase();
            const bgClass = st === 'engaged' ? 'bg-success' : (st === 'low engagement' ? 'bg-danger' : 'bg-warning');
            
            const webcamBadge = emp.webcamActive !== false ? 
                '<span class="badge bg-success bg-opacity-10 text-success border border-success px-2.5 py-1 text-nowrap"><i class="bi bi-camera-video-fill me-1"></i>ON</span>' : 
                '<span class="badge bg-danger bg-opacity-10 text-danger border border-danger px-2.5 py-1 text-nowrap"><i class="bi bi-camera-video-off-fill me-1"></i>OFF</span>';
                
            const idleDisplay = emp.idleSeconds !== undefined ? `${emp.idleSeconds}s` : '0s';
            const durationSecs = emp.durationSeconds || 0;
            const durationDisplay = `${Math.floor(durationSecs / 60)}m ${durationSecs % 60}s`;
            const codeBadge = `<span class="badge bg-primary bg-opacity-10 text-primary border border-primary font-monospace px-2.5 py-1 text-nowrap fs-7">${emp.sessionCode || liveSessionCode || 'MLD123'}</span>`;
            const activeWinDisplay = emp.activeWindow ? `<span class="fw-semibold text-primary text-nowrap"><i class="bi bi-window-desktop me-1"></i>${emp.activeWindow}</span>` : '<span class="text-muted">Desktop Workspace</span>';

            newRowsHtml += `
                <tr>
                    <td class="ps-4">
                        <div class="d-flex align-items-center text-nowrap">
                            <div class="bg-primary rounded-circle text-white d-flex justify-content-center align-items-center me-3 flex-shrink-0" style="width: 38px; height: 38px; font-weight: 600;">
                                ${emp.name.charAt(0)}
                            </div>
                            <div>
                                <h6 class="mb-0 fw-bold text-dark">${emp.name}</h6>
                                <small class="text-muted">${emp.role} ${emp.isLive ? '<span class="text-primary fw-bold ms-1">(Live Session)</span>' : "(" + emp.timestamp + ")"}</small>
                            </div>
                        </div>
                    </td>
                    <td>${activeWinDisplay}</td>
                    <td>${codeBadge}</td>
                    <td>${webcamBadge}</td>
                    <td class="text-nowrap"><span class="text-muted fw-medium">${idleDisplay}</span></td>
                    <td class="text-nowrap"><span class="text-muted fw-medium">${durationDisplay}</span></td>
                    <td style="min-width: 140px;">
                        <div class="progress mt-1" style="height: 8px;">
                            <div class="progress-bar ${bgClass}" role="progressbar" style="width: ${emp.score}%" aria-valuenow="${emp.score}" aria-valuemin="0" aria-valuemax="100"></div>
                        </div>
                        <small class="text-muted mt-1 d-block fw-bold">${emp.score}%</small>
                    </td>
                    <td class="text-nowrap">
                        <span class="badge badge-soft-${bgClass.replace('bg-', '')} px-3 py-2 rounded-pill text-capitalize">${emp.status}</span>
                    </td>
                </tr>
            `;
        });

        // Apply HTML diffing: only update DOM if HTML string has changed
        if (typeof morphdom !== 'undefined') {
            const tempTbody = document.createElement('tbody');
            tempTbody.innerHTML = newRowsHtml;
            morphdom(tbody, tempTbody, { childrenOnly: true });
        } else if (tbody.innerHTML !== newRowsHtml) {
            tbody.innerHTML = newRowsHtml;
        }

        // Load recent alerts
        const alerts = await window.api.get('/alerts');
        const alertContainer = document.getElementById('alertNotificationSection');
        if(alertContainer) {
            let newAlertsHtml = '';
            if (!alerts || alerts.length === 0) {
                newAlertsHtml = `
                    <div class="text-center py-4 text-muted">
                        <div class="bg-success bg-opacity-10 text-success rounded-circle d-inline-flex p-3 mb-2">
                            <i class="bi bi-shield-check fs-3"></i>
                        </div>
                        <h6 class="fw-bold text-dark mb-1">All Clear</h6>
                        <small class="text-muted">No low engagement alerts at this time.</small>
                    </div>
                `;
            } else {
                alerts.forEach(alert => {
                    newAlertsHtml += `
                        <div class="alert-item">
                            <div>
                                <h6 class="mb-1 fw-bold">${alert.name}</h6>
                                <small class="text-muted">${alert.reason}</small>
                            </div>
                            <span class="badge bg-danger rounded-pill px-2.5 py-1">${alert.time}</span>
                        </div>
                    `;
                });
            }

            if (alertContainer.innerHTML !== newAlertsHtml) {
                alertContainer.innerHTML = newAlertsHtml;
            }

            const metricValue = document.getElementById('alertsMetricValue');
            if(metricValue && metricValue.textContent != alerts.length) {
                metricValue.textContent = alerts.length;
            }
            
            const navBadges = document.querySelectorAll('#navAlertBadge');
            navBadges.forEach(b => {
                b.textContent = alerts.length;
                if(alerts.length > 0) b.classList.remove('d-none');
                else b.classList.add('d-none');
            });
        }
        
        // Render Latest Meeting Summary (MapReduce format)
        if (listData.length > 0) {
            const latestMeeting = listData[0];
            const summaryContainer = document.getElementById('latestMeetingSummarySection');
            const scoreBadge = document.getElementById('latestMeetingScoreBadge');
            
            if (summaryContainer && scoreBadge && latestMeeting.timeline) {
                scoreBadge.textContent = `${latestMeeting.score}% Engagement`;
                scoreBadge.className = `badge ms-2 ${latestMeeting.score >= 50 ? 'bg-success' : 'bg-danger'}`;
                
                const frequencies = {};
                latestMeeting.timeline.forEach(item => {
                    const win = item.window || "Unknown Window";
                    frequencies[win] = (frequencies[win] || 0) + 1;
                });
                
                const sortedApps = Object.entries(frequencies).sort((a, b) => b[1] - a[1]);
                
                let html = '<div class="d-flex flex-wrap gap-3 mt-2">';
                sortedApps.forEach(([app, count]) => {
                    const shortName = app.length > 40 ? app.substring(0, 40) + '...' : app;
                    html += `
                        <div class="border border-secondary rounded px-3 py-2 bg-light shadow-sm">
                            <span class="fw-medium text-dark">${shortName}</span>
                            <span class="badge bg-secondary ms-2">${count}</span>
                        </div>
                    `;
                });
                html += '</div>';
                
                const targetSummaryHtml = sortedApps.length === 0 ? '<div class="text-muted text-center py-4">No window activity recorded yet.</div>' : html;
                if (summaryContainer.innerHTML !== targetSummaryHtml) {
                    summaryContainer.innerHTML = targetSummaryHtml;
                }
            }
        }
        
    } catch (e) {
        console.error("Failed to load dashboard data", e);
        const tbody = document.getElementById('engagementTableBody');
        if(tbody && !tbody.innerHTML.includes("Backend server offline")) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>Backend server offline. Please run run.bat to view live data.</td></tr>';
        }
    }
}

async function loadAnalytics() {
    try {
        const data = await window.api.get('/analytics');
        
        // Window Focus Pie Chart
        const ctxPie = document.getElementById('focusPieChart');
        if(ctxPie) {
            let pData = data.windowFocus;
            if(pData[0] === 0 && pData[1] === 0 && pData[2] === 0) pData = [0, 0, 1];
            if (activeCharts.pie) {
                activeCharts.pie.data.datasets[0].data = pData;
                activeCharts.pie.update('none');
            } else {
                activeCharts.pie = new Chart(ctxPie, {
                    type: 'doughnut',
                    data: {
                        labels: ['Focused', 'Blurred', 'Background/Hidden'],
                        datasets: [{
                            data: pData,
                            backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                            borderWidth: 0,
                            hoverOffset: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { position: 'bottom', labels: { color: '#1e293b' } }, animation: {duration: 0} }
                    }
                });
            }
        }

        // Chat Bar Chart
        const ctxBar = document.getElementById('chatBarChart');
        if(ctxBar) {
            if (activeCharts.bar) {
                activeCharts.bar.data.datasets[0].data = data.chatActivity;
                activeCharts.bar.update('none');
            } else {
                activeCharts.bar = new Chart(ctxBar, {
                    type: 'bar',
                    data: {
                        labels: ['10m', '20m', '30m', '40m', '50m', '60m'],
                        datasets: [{
                            label: 'Messages Sent',
                            data: data.chatActivity,
                            backgroundColor: '#0ea5e9',
                            borderRadius: 4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {duration: 0},
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.1)' }, ticks: { color: '#1e293b' } },
                            x: { grid: { display: false }, ticks: { color: '#1e293b' } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            }
        }

        // Speaking Line Chart
        const ctxLine = document.getElementById('speakingLineChart');
        if(ctxLine) {
            if (activeCharts.line) {
                activeCharts.line.data.labels = data.speakingTime;
                activeCharts.line.data.datasets[0].data = data.speakingData;
                activeCharts.line.update('none');
            } else {
                activeCharts.line = new Chart(ctxLine, {
                    type: 'line',
                    data: {
                        labels: data.speakingTime,
                        datasets: [{
                            label: 'Speaking Duration (s)',
                            data: data.speakingData,
                            borderColor: '#7c3aed',
                            backgroundColor: 'rgba(124, 58, 237, 0.1)',
                            fill: true,
                            tension: 0.4
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: {duration: 0},
                        scales: {
                            y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.1)' }, ticks: { color: '#1e293b' } },
                            x: { grid: { color: 'rgba(0,0,0,0.1)' }, ticks: { color: '#1e293b' } }
                        },
                        plugins: { legend: { display: false } }
                    }
                });
            }
        }

    } catch(e) {
        console.error("Failed to load analytics", e);
    }
}

async function loadReports() {
    if (document.hidden) return; // BOOST: Pause polling when tab is inactive
    try {
        const data = await window.api.get('/engagement');
        const tbody = document.getElementById('reportsTableBody');
        if(!tbody) return;
        
        let newRowsHtml = '';
        const listData = [...data].reverse();
        listData.forEach(emp => {
            const bgClass = emp.status === 'engaged' ? 'success' : (emp.status === 'low engagement' ? 'danger' : 'warning');
            
            const safeTimelineStr = encodeURIComponent(JSON.stringify(emp.timeline || []));
            
            newRowsHtml += `
                <tr>
                    <td>${emp.name}</td>
                    <td>${emp.role}</td>
                    <td>${emp.score}%</td>
                    <td>
                        <span class="badge badge-soft-${bgClass} px-3 py-2 rounded-pill text-capitalize">${emp.status}</span>
                    </td>
                    <td><small class="text-muted">${emp.timestamp || 'N/A'}</small></td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary action-btn" data-timeline="${safeTimelineStr}">Actions</button>
                        <button class="btn btn-sm btn-outline-danger delete-btn ms-2" data-timestamp="${emp.timestamp}">Delete</button>
                    </td>
                </tr>
            `;
        });
        
        if (tbody.innerHTML !== newRowsHtml) {
            tbody.innerHTML = newRowsHtml;
            bindActionButtons();
            bindDeleteButtons();
        }

        // Export Logic
        const exportBtn = document.getElementById('exportCsvBtn');
        if (exportBtn && !exportBtn.dataset.bound) {
            exportBtn.dataset.bound = "true";
            exportBtn.addEventListener('click', () => {
                if (window.exportToGoogleSheets) {
                    window.exportToGoogleSheets();
                } else {
                    alert("Export module not loaded.");
                }
            });
        }
    } catch(e) {
        console.error("Failed to load reports", e);
        const tbody = document.getElementById('reportsTableBody');
        if(tbody && !tbody.innerHTML.includes("Backend server offline")) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-4"><i class="bi bi-exclamation-triangle-fill me-2"></i>Backend server offline. Please run run.bat to view reports.</td></tr>';
        }
    }
}

async function loadAlerts() {
    try {
        const data = await window.api.get('/alerts');
        const container = document.getElementById('alertsListContainer');
        if(!container) return;

        let newAlertsHtml = '';
        data.forEach(alert => {
            newAlertsHtml += `
                <div class="col-md-6 mb-4 alert-card">
                    <div class="card glass-card h-100 border-start border-danger border-4">
                        <div class="card-body">
                            <div class="d-flex justify-content-between align-items-center mb-3">
                                <h5 class="card-title mb-0 fw-bold">${alert.name}</h5>
                                <span class="badge bg-danger rounded-pill px-3 py-2">Low Engagement</span>
                            </div>
                            <p class="card-text text-muted mb-3">${alert.reason}</p>
                            <div class="d-flex justify-content-between align-items-center mt-auto">
                                <small class="text-secondary"><i class="bi bi-clock me-1"></i>${alert.time}</small>
                                <button class="btn btn-sm btn-outline-danger dismiss-btn">Dismiss</button>
                            </div>
                        </div>
                    </div>
                </div>
            `;
        });

        if (container.innerHTML !== newAlertsHtml) {
            container.innerHTML = newAlertsHtml;
            const dismissBtns = container.querySelectorAll('.dismiss-btn');
            dismissBtns.forEach(btn => {
                btn.addEventListener('click', function() {
                    const card = this.closest('.alert-card');
                    if (card) {
                        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                        card.style.opacity = '0';
                        card.style.transform = 'scale(0.9)';
                        setTimeout(() => card.remove(), 300);
                    }
                });
            });
        }

        // Update nav badges
        const navBadges = document.querySelectorAll('#navAlertBadge');
        navBadges.forEach(b => {
            b.textContent = data.length;
            if(data.length > 0) b.classList.remove('d-none');
            else b.classList.add('d-none');
        });

        // Add event listeners for dismiss buttons
        const dismissBtns = container.querySelectorAll('.dismiss-btn');
        dismissBtns.forEach(btn => {
            btn.addEventListener('click', function() {
                const card = this.closest('.alert-card');
                if (card) {
                    card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                    card.style.opacity = '0';
                    card.style.transform = 'scale(0.9)';
                    setTimeout(() => card.remove(), 300);
                }
            });
        });

    } catch(e) {
        console.error("Failed to load alerts", e);
    }
}

async function loadEmployeeDashboard() {
    try {
        const data = await window.api.get('/employee-stats');
        
        // Update meeting status
        const statusEl = document.getElementById('meetingStatus');
        if(statusEl) {
            statusEl.textContent = data.meetingStatus;
            if (data.meetingStatus.includes("Stopped") || data.meetingStatus.includes("Terminated")) {
                statusEl.className = "text-danger fw-bold";
                if (autoTrackerInterval) {
                    clearInterval(autoTrackerInterval);
                    autoTrackerInterval = null;
                }
            }
        }

        // Update overall score
        const scoreBar = document.getElementById('overallScoreBar');
        const scoreText = document.getElementById('overallScoreText');
        if(scoreBar) {
            scoreBar.style.width = `${data.score}%`;
            scoreBar.setAttribute('aria-valuenow', data.score);
            scoreBar.className = `progress-bar progress-bar-striped progress-bar-animated ${data.score < 50 ? 'bg-danger' : 'bg-success'}`;
        }
        if(scoreText) scoreText.textContent = `${data.score}%`;

        // Update sub-scores (Focus, Chat, Speaking)
        document.getElementById('focusScoreVal').textContent = `${data.focus}%`;
        document.getElementById('chatScoreVal').textContent = `${data.chat}%`;
        document.getElementById('speakingScoreVal').textContent = `${data.speaking}%`;
        
        const focusBar = document.getElementById('focusBar');
        if(focusBar) focusBar.style.width = `${data.focus}%`;
        
        const chatBar = document.getElementById('chatBar');
        if(chatBar) chatBar.style.width = `${data.chat}%`;
        
        const speakingBar = document.getElementById('speakingBar');
        if(speakingBar) speakingBar.style.width = `${data.speaking}%`;
        
        // Fetch and map Employee History
        const engagementData = await window.api.get('/engagement');
        const tbody = document.getElementById('employeeHistoryTableBody');
        if(tbody) {
            const username = localStorage.getItem('username');
            const myHistory = engagementData.filter(emp => !username || emp.name === username);
            const listData = [...myHistory].reverse();
            
            let newRowsHtml = '';
            if(listData.length === 0) {
                newRowsHtml = '<tr><td colspan="5" class="text-center text-muted py-4">No history records found.</td></tr>';
            } else {
                listData.forEach(emp => {
                    const badgeClass = emp.status === 'engaged' ? 'success' : (emp.status === 'low engagement' ? 'danger' : 'warning');
                    const safeTimelineStr = encodeURIComponent(JSON.stringify(emp.timeline || []));
                    
                    newRowsHtml += `
                        <tr>
                            <td><span class="ps-3">${emp.name}</span></td>
                            <td>${emp.role}</td>
                            <td><span class="fw-bold">${emp.score}%</span></td>
                            <td><span class="badge badge-soft-${statusClass} px-3 py-2 rounded-pill text-capitalize">${emp.status}</span></td>
                            <td><button class="btn btn-sm btn-outline-primary action-btn" data-timeline="${safeTimelineStr}">Actions</button></td>
                        </tr>
                    `;
                });
            }

            if (tbody.innerHTML !== newRowsHtml) {
                tbody.innerHTML = newRowsHtml;
                bindActionButtons();
            }
        }

    } catch(e) {
        console.error("Failed to load employee stats", e);
    }
}

// Ensure Action modals bind cleanly
function bindActionButtons() {
    document.querySelectorAll('.action-btn').forEach(btn => {
        // Prevent stacking event listeners tightly inside intervals
        btn.replaceWith(btn.cloneNode(true));
    });
    
    document.querySelectorAll('.action-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const timelineDataStr = decodeURIComponent(this.getAttribute('data-timeline'));
            const timelineData = JSON.parse(timelineDataStr);
            
            const mb = document.getElementById('timelineModalBody');
            if(!mb) return;
            
            mb.innerHTML = '';
            if(timelineData.length === 0) {
                mb.innerHTML = '<tr><td colspan="3" class="text-center text-muted py-4">No timeline activity stored.</td></tr>';
            } else {
                timelineData.forEach((check, index) => {
                    const timeSec = index * 10;
                    const winName = check.window || "Desktop Workspace";
                    const lowerWin = winName.toLowerCase();
                    const isMeetingOrWorkspace = check.focused || 
                        lowerWin.includes("zoom") || 
                        lowerWin.includes("meet") || 
                        lowerWin.includes("teams") || 
                        lowerWin.includes("powerpoint") || 
                        lowerWin.includes("webex") || 
                        lowerWin.includes("slack");

                    const classText = isMeetingOrWorkspace ? '<span class="text-success fw-bold">Focused</span>' : '<span class="text-danger">Distracted</span>';
                    mb.innerHTML += `
                        <tr>
                            <td class="ps-4">${timeSec}s</td>
                            <td><small class="text-secondary">${winName}</small></td>
                            <td>${classText}</td>
                        </tr>
                    `;
                });
            }
            
            const timelineModalNode = document.getElementById('timelineModal');
            if(timelineModalNode) {
                const modalInst = new bootstrap.Modal(timelineModalNode);
                modalInst.show();
            }
        });
    });
}

// Bind Delete buttons
function bindDeleteButtons() {
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    
    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.addEventListener('click', async function() {
            const timestamp = this.getAttribute('data-timestamp');
            if(timestamp && confirm('Are you sure you want to delete this record?')) {
                try {
                    await window.api.delete(`/engagement?timestamp=${encodeURIComponent(timestamp)}`);
                    loadReports(); // Refresh the table
                } catch(e) {
                    console.error("Failed to delete record", e);
                    alert("Error deleting record.");
                }
            }
        });
    });
}

// --- Manager Modals & Notifications Logic ---

async function loadUserProfile() {
    try {
        const data = await window.api.get('/profile');
        if (!data || !data.name) return;
        
        // Manager Dropdown Elements
        const nameEl = document.getElementById('profileName');
        if (nameEl) nameEl.innerText = data.name;
        
        const roleEl = document.getElementById('profileRole');
        if (roleEl) roleEl.innerText = data.role || (data.email ? data.email : 'USER');
        
        const orgCodeEl = document.getElementById('profileOrgCode');
        if (orgCodeEl) orgCodeEl.innerText = data.orgCode || '----';
        
        const imgModal = document.getElementById('profileModalImg');
        if (imgModal) imgModal.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=7c3aed&color=fff&size=80`;
        
        const imgNav = document.getElementById('managerProfileImg');
        if (imgNav) imgNav.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=7c3aed&color=fff`;
        
        // Employee Dashboard Elements
        const empNameEl = document.getElementById('employeeProfileName');
        if (empNameEl) empNameEl.innerText = data.name;
        const empImg = document.getElementById('employeeProfileImg');
        if (empImg) empImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.name)}&background=0ea5e9&color=fff`;
        
    } catch (e) {
        console.error('Failed to load profile details', e);
    }
}

async function initManagerModals() {
    const manageEmployeesModal = document.getElementById('manageEmployeesModal');
    if (manageEmployeesModal) {
        manageEmployeesModal.addEventListener('show.bs.modal', async () => {
            await loadEmployeesList();
        });
    }
}

async function loadEmployeesList() {
    const tbody = document.getElementById('employeesListBody');
    if (!tbody) return;
    
    try {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">Loading...</td></tr>';
        const employees = await window.api.get('/employees');
        
        if (!employees || employees.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No employees found.</td></tr>';
            return;
        }

        tbody.innerHTML = employees.map(emp => `
            <tr>
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(emp.name)}&background=e2e8f0&color=475569" class="rounded-circle" width="32" height="32">
                        <span class="fw-medium">${emp.name}</span>
                    </div>
                </td>
                <td class="text-muted">${emp.email}</td>
                <td class="text-muted">${new Date(emp.joinedAt).toLocaleDateString()}</td>
                <td class="text-end pe-4">
                    <button class="btn btn-sm btn-outline-danger remove-emp-btn" data-id="${emp.id}" data-name="${emp.name}">
                        <i class="bi bi-person-x"></i> Remove
                    </button>
                </td>
            </tr>
        `).join('');

        // Bind remove buttons
        document.querySelectorAll('.remove-emp-btn').forEach(btn => {
            btn.addEventListener('click', async function() {
                const id = this.getAttribute('data-id');
                const name = this.getAttribute('data-name');
                if (confirm(`Are you sure you want to completely remove ${name} from your organization?`)) {
                    try {
                        const res = await window.api.post('/employees/remove', { id: id });
                        if (res.success) {
                            alert(`${name} has been removed.`);
                            loadEmployeesList(); // refresh
                        } else {
                            alert(`Failed to remove employee: ${res.message || 'Unknown error'}`);
                        }
                    } catch(e) {
                        alert('Network error while attempting to remove employee.');
                    }
                }
            });
        });

    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-danger">Failed to load employees.</td></tr>';
    }
}

async function loadManagerNotifications() {
    const list = document.getElementById('notifList');
    const badge = document.getElementById('notifBadge');
    if (!list || !badge) return;

    try {
        const notifs = await window.api.get('/notifications');
        const count = notifs ? notifs.length : 0;
        
        if (count > 0) {
            badge.classList.remove('d-none');
            // Remove previous dynamic items
            list.querySelectorAll('.dynamic-notif').forEach(n => n.remove());
            
            const noNotif = document.getElementById('noNotifItem');
            if (noNotif) noNotif.classList.add('d-none');

            // Append new items
            notifs.forEach(n => {
                const li = document.createElement('li');
                li.className = 'dynamic-notif';
                li.innerHTML = `
                    <a class="dropdown-item py-2 border-bottom" href="#">
                        <div class="d-flex align-items-center gap-2">
                            <i class="bi bi-person-check-fill text-success"></i>
                            <span class="text-wrap small" style="max-width: 250px;">${n.message}</span>
                        </div>
                        <div class="text-muted mt-1" style="font-size: 0.75rem;">${new Date(n.time).toLocaleString()}</div>
                    </a>
                `;
                list.appendChild(li);
            });
        } else {
            badge.classList.add('d-none');
            const noNotif = document.getElementById('noNotifItem');
            if (noNotif) noNotif.classList.remove('d-none');
            list.querySelectorAll('.dynamic-notif').forEach(n => n.remove());
        }
    } catch (e) {
        console.error('Failed to load notifications');
    }
}

