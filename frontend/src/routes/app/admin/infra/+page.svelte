<script lang="ts">
  import { onMount } from 'svelte';
  import { getInfraSettings, updateInfraSettings } from '$lib/api/infra';

  let loading = true;
  let error: string | null = null;
  let saved = false;

  let windowMs = 15 * 60 * 1000;
  let adminMax = 50;
  let allowlistRaw = '';

  onMount(async () => {
    try {
      const s = await getInfraSettings();
      windowMs = s.rateLimit.windowMs;
      adminMax = s.rateLimit.adminMax;
      allowlistRaw = (s.allowlist ?? []).join(', ');
    } catch (e) {
      console.error(e);
      error = 'Failed to load infra settings';
    } finally {
      loading = false;
    }
  });

  function minutes(val: number) {
    return Math.round(val / 60000);
  }

  async function save() {
    error = null;
    saved = false;
    // naive validation mirrors backend constraints
    if (windowMs < 60000 || windowMs > 24 * 60 * 60 * 1000) {
      error = 'windowMs must be between 60,000 and 86,400,000';
      return;
    }
    if (adminMax < 1 || adminMax > 10000) {
      error = 'adminMax must be between 1 and 10,000';
      return;
    }
    const allowlist = allowlistRaw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      const next = await updateInfraSettings({ rateLimit: { windowMs, adminMax }, allowlist });
      windowMs = next.rateLimit.windowMs;
      adminMax = next.rateLimit.adminMax;
      allowlistRaw = (next.allowlist ?? []).join(', ');
      saved = true;
      setTimeout(() => (saved = false), 2000);
    } catch (e) {
      console.error(e);
      error = 'Failed to save infra settings';
    }
  }
</script>

<div class="max-w-xl mx-auto space-y-4 p-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold">Infra & Security</h1>
    <a class="text-sm text-blue-600 hover:underline" href="/app/admin">← Back to Admin</a>
  </div>

  {#if loading}
    <div class="text-slate-400">Loading…</div>
  {:else}
    {#if error}
      <div class="p-3 rounded border border-red-300 bg-red-50 text-red-700 mb-4">{error}</div>
    {/if}
    <div class="space-y-4 border p-3 rounded">
      <div>
        <label class="block text-sm text-slate-500" for="infra-window">Rate limit window (ms)</label>
        <input id="infra-window" type="number" min="60000" max="86400000" class="w-full rounded border px-3 py-2 bg-white/5" bind:value={windowMs} />
        <p class="text-xs text-slate-500">≈ {minutes(windowMs)} minutes</p>
      </div>
      <div>
        <label class="block text-sm text-slate-500" for="infra-max">Admin max requests</label>
        <input id="infra-max" type="number" min="1" max="10000" class="w-full rounded border px-3 py-2 bg-white/5" bind:value={adminMax} />
      </div>
      <div>
        <label class="block text-sm text-slate-500" for="infra-allow">Admin allowlist (comma-separated IPs)</label>
        <input id="infra-allow" class="w-full rounded border px-3 py-2 bg-white/5" bind:value={allowlistRaw} placeholder="127.0.0.1, 10.0.0.1" />
      </div>
      <div class="text-xs text-amber-600">Changes take effect immediately for new requests. Keep a safe IP in the allowlist to avoid lockout.</div>
      <button class="rounded bg-emerald-600 text-white px-3 py-2 hover:bg-emerald-700" on:click|preventDefault={save}>Save</button>
      {#if saved}<span class="ml-2 text-sm text-emerald-500">Saved</span>{/if}
    </div>
  {/if}
</div>
