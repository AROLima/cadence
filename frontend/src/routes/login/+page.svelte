<script lang="ts">
  import { page } from '$app/stores';

  const form = $derived($page.form);
</script>

<div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
  <div class="w-full max-w-md space-y-6">
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-semibold">Welcome back</h1>
      <p class="text-sm text-slate-400">Sign in with your credentials to access Finace.</p>
    </div>

    {#if form?.message}
      <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {form.message}
      </div>
    {/if}

    <form method="POST" class="space-y-4">
      <div class="space-y-2">
        <label class="block text-sm font-medium" for="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autocomplete="email"
          class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      <div class="space-y-2">
        <label class="block text-sm font-medium" for="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autocomplete="current-password"
          class="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
        />
      </div>

      <button
        type="submit"
        class="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
      >
        Sign in
      </button>
    </form>
  </div>
</div>
