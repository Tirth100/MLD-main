const TIMEOUT_MS = 25000;

export function getApiBaseUrl() {
    const origin = window.location.origin;
    if (!origin || origin === 'null' || origin.startsWith('file:') || origin.includes('localhost') || origin.includes('127.0.0.1')) {
        return 'http://localhost:3000/api';
    }
    return 'https://mld-server.onrender.com/api';
}

async function fetchWithTimeout(resource, options = {}, timeout = TIMEOUT_MS) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, {
            ...options,
            signal: controller.signal  
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

export const api = {
    async get(endpoint) {
        try {
            const baseUrl = getApiBaseUrl();
            const token = localStorage.getItem('uuid_token');
            const headers = { 'Bypass-Tunnel-Reminder': 'true' };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, { headers, cache: 'no-store' }, 25000);
            const text = await response.text();
            
            try {
                if (!response.ok) {
                    if (response.status === 401) {
                        return { success: false, status: 401, message: 'Unauthorized' };
                    }
                    if (!text || text.trim() === '') {
                        return { success: false, status: response.status, message: `HTTP Error ${response.status}` };
                    }
                }
                if (!text || text.trim() === '') return { success: true };
                return JSON.parse(text);
            } catch (e) {
                console.error("Failed to parse API response as JSON", text);
                return { success: false, status: 500, message: 'Backend server returned non-JSON response. It may be offline or starting up.' };
            }
        } catch (error) {
            console.error('API Get Error:', error);
            if (error.name === 'AbortError') {
                return { success: false, message: 'Request timed out while waiting for backend server to respond. Please try again.' };
            }
            throw error;
        }
    },

    async post(endpoint, data = {}) {
        try {
            const baseUrl = getApiBaseUrl();
            const token = localStorage.getItem('uuid_token');
            const headers = {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'true'
            };
            if (token) headers['Authorization'] = 'Bearer ' + token;

            const response = await fetchWithTimeout(`${baseUrl}${endpoint}`, {
                method: 'POST',
                headers,
                body: JSON.stringify(data),
                cache: 'no-store'
            }, 30000);
            
            const text = await response.text();
            try {
                return JSON.parse(text);
            } catch (e) {
                if (!response.ok && response.status === 401) {
                    return { success: false, status: 401, message: 'Unauthorized' };
                }
                return { success: response.ok, message: text || `HTTP Error ${response.status}` };
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
