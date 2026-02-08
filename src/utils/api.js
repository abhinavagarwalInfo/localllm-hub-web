/**
 * src/utils/api.js   (also copy to src/api/client.js — see below)
 *
 * Routing logic:
 *   localhost / 127.0.0.1  →  relative URL  (Vite proxy forwards to backend)
 *   any other hostname     →  http://<host>:SERVER_PORT/api/…  (direct)
 *
 * SERVER_PORT must match the PORT in your .env / server/index.js  (default 3001).
 */

// ── backend port – must match server/index.js  (process.env.PORT || 3001) ──
const SERVER_PORT = 3001;

function getBackendBase() {
  // hard override via .env  →  add VITE_API_URL=http://… to your .env if needed
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  const { hostname, protocol } = window.location;

  // on localhost the Vite proxy handles /api/* → backend, so use relative URLs
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '';

  // network IP / domain → talk directly to the backend port
  return `${protocol}//${hostname}:${SERVER_PORT}`;
}

const BASE = getBackendBase();
console.log(`[api] base = "${BASE || '(vite proxy)'}"  (hostname = ${window.location.hostname})`);

/**
 * apiRequest(endpoint, options?)
 *   Drop-in for fetch().  Just pass the path – origin is added automatically.
 *
 *   const res = await apiRequest('/api/auth/me');
 *   const res = await apiRequest('/api/users', { method: 'POST', body: JSON.stringify({…}) });
 */
export async function apiRequest(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };

  // FormData: browser must set Content-Type so it can include the boundary
  if (options.body instanceof FormData) delete headers['Content-Type'];

  const url = `${BASE}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      credentials: 'include',
      headers
    });
    return response;
  } catch (err) {
    console.error(`❌ API Request Failed: ${options.method || 'GET'} ${url}`, err);
    throw err;
  }
}

export default apiRequest;