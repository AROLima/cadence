// Simple smoke test for finance transactions flow
// Usage: node backend/scripts/smoke-finance.mjs

const BASE_URL = process.env.API_BASE_URL || 'http://127.0.0.1:3000';

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
  console.log(`[smoke] Base URL: ${BASE_URL}`);

  // Quick health check to provide clearer diagnostics if API isn't up
  try {
    const health = await fetch(`${BASE_URL}/health`);
    console.log('[smoke] Health:', health.status, health.statusText);
  } catch (e) {
    throw new Error(`Cannot reach API at ${BASE_URL}. Is the backend running?`);
  }

  // 1) Login
  const login = await jsonFetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    body: JSON.stringify({ email: 'demo@orga.app', password: 'demo1234' }),
  });
  const accessToken = login?.data?.accessToken;
  if (!accessToken) throw new Error('No access token in login response');
  console.log('[smoke] Logged in');

  const authHeaders = { Authorization: `Bearer ${accessToken}` };

  // 2) List accounts
  const accounts = await jsonFetch(`${BASE_URL}/finance/accounts`, {
    headers: authHeaders,
  });
  const firstAccount = accounts?.data?.[0];
  if (!firstAccount?.id) throw new Error('No accounts returned');
  console.log(`[smoke] Using account #${firstAccount.id} (${firstAccount.name})`);

  // 3) Create EXPENSE transaction
  const payload = {
    type: 'EXPENSE',
    accountId: firstAccount.id,
    amount: 12.34,
    occurredAt: new Date().toISOString(),
    notes: 'Smoke test expense',
  };

  const created = await jsonFetch(`${BASE_URL}/finance/transactions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify(payload),
  });

  const tx = created?.data;
  console.log('[smoke] Created transaction:', {
    id: tx?.id,
    type: tx?.type,
    accountId: tx?.accountId,
    amount: tx?.amount,
    occurredAt: tx?.occurredAt,
  });
}

main().catch((err) => {
  console.error('[smoke] FAILED:', err.message);
  process.exit(1);
});
