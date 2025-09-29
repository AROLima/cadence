<script lang="ts">
  import { FormInput } from '$lib/ui/form';

  type LoginAction = { success: false; message: string; email?: string } | undefined;
  export let form: LoginAction;
  let submitting = false;

  const onSubmit = () => {
    submitting = true;
  };

  const onDone = () => {
    submitting = false;
  };
</script>

<div class="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-4">
  <div class="w-full max-w-md space-y-6">
    <div class="text-center space-y-2">
      <h1 class="text-3xl font-semibold">Welcome back</h1>
  <p class="text-sm text-slate-400">Sign in with your credentials to access Cadence.</p>
    </div>

    {#if form?.message}
      <div class="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {form.message}
      </div>
    {/if}

  <form class="space-y-4" method="POST" on:submit={onSubmit} on:invalid={onDone} on:reset={onDone} on:change={() => (submitting = false)}>
      <FormInput
        id="email"
        name="email"
        type="email"
        label="Email"
        placeholder="you@example.com"
        value={form?.email ?? ''}
        required
      />
      <FormInput
        id="password"
        name="password"
        type="password"
        label="Password"
        placeholder="••••••••"
        required
      />

      <button
        type="submit"
        class="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
        disabled={submitting}
      >
        {submitting ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
      <p class="text-xs text-slate-400 text-center">
        New to Cadence?
        <a href="/register" class="text-slate-200 underline hover:text-white">Create an account</a>
      </p>
  </div>
</div>
