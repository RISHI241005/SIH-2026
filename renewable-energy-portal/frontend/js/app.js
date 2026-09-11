const API_BASE = '';
function checkAuth() {
    const user = localStorage.getItem('user');
    if (!user) { location.href = '/login'; return false; }
    return JSON.parse(user);
}
function showLoading() { location.href = '/loading'; }
async function apiCall(endpoint, method = 'GET', data = null) {
    const options = { method, headers: { 'Content-Type': 'application/json' } };
    if (data) options.body = JSON.stringify(data);
    try { const res = await fetch(API_BASE + endpoint, options); return await res.json(); }
    catch(e) { console.error('API Error:', e); return null; }
}
document.addEventListener('DOMContentLoaded', () => {
    const page = window.location.pathname;
    if (['/admin', '/energy-tracking', '/ai-desk', '/forecasts', '/approvals', '/feedback', '/complaints'].includes(page)) {
        const user = checkAuth();
        if (!user) location.href = '/login';
    }
});
