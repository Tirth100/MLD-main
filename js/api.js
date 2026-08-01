const getApiBaseUrl = () => {
    const saved = localStorage.getItem('mld_server_url');
    const origin = window.location.origin;
    const isLocal = origin.includes('localhost') || origin.includes('127.0.0.1') || origin.includes('file:');
    
    if (saved) {
        if (isLocal) return saved;
        if (!saved.includes('localhost') && !saved.includes('127.0.0.1')) return saved;
    }
    
    if (isLocal) {
        return 'http://localhost:3000/api';
    }
    return 'https://mld-server.onrender.com/api';
};

const API_BASE_URL = getApiBaseUrl();
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
        windowFocus: [65, 25, 10], // focused, blurred, background
        chatActivity: [12, 19, 3, 5, 2, 3], // messages per 10 mins
        speakingTime: [0, 5, 10, 15, 20, 25, 30], // mock labels
        speakingData: [10, 25, 40, 20, 60, 50, 80] // mock data
    },
    employeeStats: {
        score: 45,
        focus: 30,
        chat: 60,
        speaking: 20,
        meetingStatus: 'In Progress: Weekly Sync'
    }
};

const api = {
    async get(endpoint) {
        if (USE_MOCK_DATA) {
            return new Promise((resolve) => {
                setTimeout(() => {
                    // Route mock requests
                    if (endpoint.includes('engagement')) resolve(mockData.employeeEngagement);
                    else if (endpoint.includes('alerts')) resolve(mockData.alerts);
                    else if (endpoint.includes('analytics')) resolve(mockData.analytics);
                    else if (endpoint.includes('employee-stats')) resolve(mockData.employeeStats);
                    else resolve([]);
                }, 500); // simulate network delay
            });
        }

        try {
            const token = localStorage.getItem('uuid_token');
            const headers = { 'Cache-Control': 'no-store', 'Bypass-Tunnel-Reminder': 'true' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const response = await fetch(`${API_BASE_URL}${endpoint}`, { headers });
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Non-JSON response from backend:', text);
                throw new Error('Backend server returned non-JSON data. Ensure server is active.');
            }
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    },
    async delete(endpoint) {
        if (USE_MOCK_DATA) return Promise.resolve({});
        try {
            const headers = { 'Bypass-Tunnel-Reminder': 'true' };
            const response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'DELETE', headers });
            if (!response.ok) throw new Error('Network response was not ok');
            return true;
        } catch (error) {
            console.error('API Delete Error:', error);
            throw error;
        }
    },
    async post(endpoint, data = {}) {
        if (USE_MOCK_DATA) return Promise.resolve({});
        try {
            const token = localStorage.getItem('uuid_token');
            const headers = { 'Content-Type': 'application/json' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const response = await fetch(`${API_BASE_URL}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data)
            });
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                console.error('Non-JSON response from backend:', text);
                throw new Error('Backend server returned non-JSON data. Ensure server is active.');
            }
        } catch (error) {
            console.error('API Post Error:', error);
            throw error;
        }
    }
};

window.api = api;
