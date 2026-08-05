const getApiBaseUrl = () => {
    const saved = localStorage.getItem('mld_server_url');
    if (saved && saved.trim() !== '') {
        return saved.endsWith('/') ? saved.slice(0, -1) : saved;
    }
    
    const origin = window.location.origin;
    if (!origin || origin === 'null' || origin.startsWith('file:') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return 'http://localhost:3000/api';
    }
    
    // When hosted on Render (e.g. mld-main.onrender.com), route API calls to central backend server
    if (origin.includes('onrender.com')) {
        return 'https://mld-server.onrender.com/api';
    }
    
    return origin.endsWith('/') ? origin.slice(0, -1) + '/api' : origin + '/api';
};

const USE_MOCK_DATA = false;

const mockData = {
    employeeEngagement: [
        { id: 1, name: 'Alice Smith', role: 'Developer', score: 92, status: 'engaging' },
        { id: 2, name: 'Bob Jones', role: 'Designer', score: 45, status: 'leeching' },
        { id: 3, name: 'Charlie Brown', role: 'Product', score: 78, status: 'neutral' },
        { id: 4, name: 'Diana Prince', role: 'Marketing', score: 30, status: 'leeching' }
    ],
    alerts: [
        { id: 1, name: 'Bob Jones', reason: 'Window out of focus for 15 mins', time: '10 mins ago' },
        { id: 2, name: 'Diana Prince', reason: 'No speaking or chat activity', time: '25 mins ago' }
    ],
    analytics: {
        windowFocus: [65, 25, 10],
        chatActivity: [12, 19, 3, 5, 2, 3],
        speakingTime: [0, 5, 10, 15, 20, 25, 30],
        speakingData: [10, 25, 40, 20, 60, 50, 80]
    },
    employeeStats: {
        score: 45,
        focus: 30,
        chat: 60,
        speaking: 20,
        meetingStatus: 'In Progress: Weekly Sync'
    }
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = 25000) => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
};

const api = {
    async get(endpoint) {
        if (USE_MOCK_DATA) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    if (endpoint.includes('engagement')) resolve(mockData.employeeEngagement);
                    else if (endpoint.includes('alerts')) resolve(mockData.alerts);
                    else if (endpoint.includes('analytics')) resolve(mockData.analytics);
                    else if (endpoint.includes('employee-stats')) resolve(mockData.employeeStats);
                    else resolve([]);
                }, 300);
            });
        }

        try {
            const baseUrl = getApiBaseUrl();
            const token = localStorage.getItem('uuid_token');
            const headers = { 'Cache-Control': 'no-store', 'Bypass-Tunnel-Reminder': 'true' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, { headers }, 25000);
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Non-JSON response from backend:', text);
                if (!text || text.trim() === '') {
                    return { success: false, message: 'Backend server returned an empty response. The server may still be spinning up, please try again in a few seconds.' };
                }
                return { success: false, message: 'Backend server returned non-JSON response.' };
            }
        } catch (error) {
            console.error('API Get Error:', error);
            if (error.name === 'AbortError') {
                return { success: false, message: 'Request timed out while waiting for backend server to respond. Please try again.' };
            }
            throw error;
        }
    },
    async delete(endpoint) {
        if (USE_MOCK_DATA) return Promise.resolve(true);
        try {
            const baseUrl = getApiBaseUrl();
            const headers = { 'Bypass-Tunnel-Reminder': 'true' };
            const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, { method: 'DELETE', headers }, 25000);
            return response.ok;
        } catch (error) {
            console.error('API Delete Error:', error);
            return false;
        }
    },
    async post(endpoint, data = {}) {
        if (USE_MOCK_DATA) return Promise.resolve({ success: true });
        try {
            const baseUrl = getApiBaseUrl();
            const token = localStorage.getItem('uuid_token');
            const headers = { 'Content-Type': 'application/json', 'Bypass-Tunnel-Reminder': 'true' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            }, 25000);
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Non-JSON response from backend:', text);
                if (!text || text.trim() === '') {
                    return { success: false, message: 'Backend server returned an empty response. The server may still be spinning up, please try again in a few seconds.' };
                }
                return { success: false, message: 'Backend server returned non-JSON response.' };
            }
        } catch (error) {
            console.error('API Post Error:', error);
            if (error.name === 'AbortError') {
                return { success: false, message: 'Request timed out while waiting for backend server to respond. Please try again.' };
            }
            throw error;
        }
    }
};

window.api = api;
