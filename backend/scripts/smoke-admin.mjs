// Smoke test for admin role access
// Usage: node backend/scripts/smoke-admin.mjs

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@orga.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin1234';

async function jsonFetch(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (e) {
    throw new Error(`Non-JSON response from ${url}: ${text}`);
  }
  if (!res.ok || data?.success === false) {
    const msg = (Array.isArray(data?.message) ? data.message[0] : data?.message) || res.statusText;
    throw new Error(`${res.status} ${msg}`);
  }
  return data;
}

async function main() {
  console.log(`[admin-smoke] Base URL: ${BASE_URL}`);

  // 1) Login as admin
  const login = await jsonFetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });
  const accessToken = login?.data?.accessToken;
  if (!accessToken) throw new Error('No access token in login response');
  console.log('[admin-smoke] Logged in as admin');

  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  // 2) Call an ADMIN-only endpoint
  const users = await jsonFetch(`${BASE_URL}/users`, { headers: authHeaders });
  const count = users?.meta?.total ?? users?.data?.length ?? 0;
  console.log(`[admin-smoke] Users list accessible. Count: ${count}`);
}

main().catch((err) => {
  console.error('[admin-smoke] FAILED:', err.message);
  process.exit(1);
});
