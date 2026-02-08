/**
 * src/api/client.js
 *
 * This is the file that App.jsx (and potentially others) actually import.
 * It re-exports everything from the canonical api.js logic so both paths work.
 *
 * Routing:
 *   localhost / 127.0.0.1  →  relative URL  (Vite proxy → backend)
 *   network IP / domain    →  http://<host>:3001/api/…
 *
 * PORT **must** match server/index.js  →  process.env.PORT || 3001
 */

// ── backend port ─────────────────────────────────────────
const SERVER_PORT = 3001;                          // ← keep in sync with server/index.js

function getBackendBase() {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;

  const { hostname, protocol } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1') return '';

  return `${protocol}//${hostname}:${SERVER_PORT}`;
}

const BASE = getBackendBase();
console.log(`[api/client] base = "${BASE || '(vite proxy)'}"  (hostname = ${window.location.hostname})`);

// ── core request function ────────────────────────────────
export async function apiRequest(endpoint, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
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