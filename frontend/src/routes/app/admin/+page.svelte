<script lang="ts">
  import { apiFetch } from '$lib/utils/api';
  import { API_BASE_URL } from '$lib/config';
  import { onMount } from 'svelte';
  import { getAdminSettings, updateAdminSettings } from '$lib/api/admin';
  import { getCurrencyOptions } from '$lib/utils/currency';
  const currencyOptions = getCurrencyOptions();
  let message = '';
  let userId = '';
  let fromAccountId = '';
  let toAccountId = '';

  let adminLoading = true;
  let adminError: string | null = null;
  let adminSaved = false;
  let adminSettings = {
    companyName: 'Cadence',
    defaultCurrency: 'USD',
    fiscalMonthStart: 1,
  };
  let rateLimit = { windowMs: 15 * 60 * 1000, adminMax: 50 };
  let allowlist: string[] = [];

  onMount(async () => {
    adminLoading = true;
    adminError = null;
    try {
      const env = await getAdminSettings();
      adminSettings = env.settings;
      rateLimit = env.rateLimit;
      allowlist = env.allowlist;
    } catch (e) {
      adminError = 'Failed to load admin settings';
      console.error(e);
    } finally {
      adminLoading = false;
    }
  });

  async function saveAdmin() {
    adminError = null;
    adminSaved = false;
    try {
      adminSettings = await updateAdminSettings(adminSettings);
      adminSaved = true;
      setTimeout(() => (adminSaved = false), 2000);
    } catch (e) {
      adminError = 'Failed to save admin settings';
      console.error(e);
    }
  }

  async function call(path: string, body: any = {}) {
    message = 'Working...';
    try {
      const res = await apiFetch(`/admin/tools/${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      message = JSON.stringify(payload?.data ?? payload);
    } catch (e: any) {
      message = e?.message || 'Failed';
    }
  }

  function revoke() {
    if (!userId) { message = 'userId required'; return; }
    void call(`revoke-refresh/${userId}`);
  }

  function reassign() {
    if (!userId || !fromAccountId || !toAccountId) { message = 'userId, fromAccountId, toAccountId required'; return; }
    void call('reassign-transactions', { userId: Number(userId), fromAccountId: Number(fromAccountId), toAccountId: Number(toAccountId) });
  }

  function recalc() {
    if (!userId) { message = 'userId required'; return; }
    void call('recalc-balances', { userId: Number(userId) });
  }
</script>

<div class="max-w-xl mx-auto space-y-4 p-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Admin</h1>
    <a class="text-sm text-blue-600 hover:underline" href={`${API_BASE_URL}/admin`} rel="noopener noreferrer" target="_blank">Open AdminJS ↗</a>
  </div>
  <h2 class="text-lg font-medium mt-2">Support Console</h2>

  <div class="space-y-2 border p-3 rounded">
    <h2 class="font-medium">Revoke refresh tokens</h2>
    <input class="w-full rounded border px-3 py-2 bg-white/5" placeholder="User ID" bind:value={userId} />
    <button class="rounded bg-amber-500 text-white px-3 py-2 hover:bg-amber-600" on:click={revoke}>Revoke</button>
  </div>

  <div class="space-y-2 border p-3 rounded">
    <h2 class="font-medium">Reassign transactions</h2>
    <input class="w-full rounded border px-3 py-2 bg-white/5" placeholder="User ID" bind:value={userId} />
    <input class="w-full rounded border px-3 py-2 bg-white/5" placeholder="From Account ID" bind:value={fromAccountId} />
    <input class="w-full rounded border px-3 py-2 bg-white/5" placeholder="To Account ID" bind:value={toAccountId} />
    <button class="rounded bg-indigo-500 text-white px-3 py-2 hover:bg-indigo-600" on:click={reassign}>Reassign</button>
  </div>

  <div class="space-y-2 border p-3 rounded">
    <h2 class="font-medium">Recalculate balances</h2>
    <input class="w-full rounded border px-3 py-2 bg-white/5" placeholder="User ID" bind:value={userId} />
    <button class="rounded bg-slate-600 text-white px-3 py-2 hover:bg-slate-700" on:click={recalc}>Recalculate</button>
  </div>

  <pre class="p-2 bg-base-200 rounded text-sm">{message}</pre>

  <h2 class="text-lg font-medium mt-6">Admin Settings</h2>
  <div>
    <a href="/app/admin/infra" class="text-sm text-blue-500 hover:underline">Infra & Security →</a>
  </div>
  {#if adminLoading}
    <div class="text-slate-400">Loading settings…</div>
  {:else}
    {#if adminError}
      <div class="p-3 rounded border border-red-300 bg-red-50 text-red-700 mb-4">{adminError}</div>
    {/if}
    <div class="space-y-4 border p-3 rounded">
      <label class="block">
        <span class="text-sm text-slate-500">Company name</span>
        <input class="w-full rounded border px-3 py-2 bg-white/5" bind:value={adminSettings.companyName} />
      </label>
      <label class="block">
        <span class="text-sm text-slate-500">Default currency</span>
        <select class="w-full rounded border px-3 py-2 bg-white/5" bind:value={adminSettings.defaultCurrency}>
          {#each currencyOptions as c}
            <option value={c.code}>{c.code} – {c.symbol} {c.name}</option>
          {/each}
        </select>
      </label>
      <label class="block">
        <span class="text-sm text-slate-500">Fiscal year start month</span>
        <select class="w-full rounded border px-3 py-2 bg-white/5" bind:value={adminSettings.fiscalMonthStart}>
          {#each Array.from({ length: 12 }, (_, i) => i + 1) as m}
            <option value={m}>{m}</option>
          {/each}
        </select>
      </label>
      <div class="text-xs text-slate-500">
        <div>Rate limit: window {Math.round(rateLimit.windowMs / 60000)} min, max {rateLimit.adminMax} req</div>
        <div>Admin allowlist: {allowlist.length ? allowlist.join(', ') : '(none)'}</div>
      </div>
      <button class="rounded bg-emerald-600 text-white px-3 py-2 hover:bg-emerald-700" on:click|preventDefault={saveAdmin}>Save</button>
      {#if adminSaved}
        <span class="ml-2 text-sm text-emerald-500">Saved</span>
      {/if}
    </div>
  {/if}
</div>
