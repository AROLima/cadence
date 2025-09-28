<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { FinanceAccount } from '$lib/types/finance';
  import type { AccountPayload } from '$lib/types/finance';

  export let open = false;
  export let account: FinanceAccount | null = null;
  export let isSaving = false;

  const dispatch = createEventDispatcher<{
    close: void;
    submit: AccountPayload;
  }>();

  type FormState = {
    name: string;
    type: string;
    initialBalance: string;
  };

  let form: FormState = {
    name: '',
    type: '',
    initialBalance: '',
  };

  let syncKey: string | null = null;

  const computeKey = () => {
    if (!open) return null;
    return account ? `account-${account.id}` : 'create';
  };

  const resetForm = () => {
    form = {
      name: '',
      type: '',
      initialBalance: '',
    };
  };

  const hydrateFromAccount = (value: FinanceAccount) => {
    form = {
      name: value.name,
      type: value.type,
      initialBalance: value.initialBalance !== undefined ? String(value.initialBalance) : '',
    };
  };

  $: currentKey = computeKey();
  $: if (open) {
    if (currentKey !== syncKey) {
      if (account) {
        hydrateFromAccount(account);
      } else {
        resetForm();
      }
      syncKey = currentKey;
    }
  } else if (syncKey) {
    syncKey = null;
  }

  const close = () => {
    if (isSaving) return;
    dispatch('close');
  };

  const parseAmount = (value: string): number | undefined => {
    const raw = value?.trim() ?? '';
    if (!raw) return undefined;
    let canonical = raw.replace(/\s+/g, '');
    if (canonical.includes('.') && canonical.includes(',')) {
      canonical = canonical.replace(/\./g, '').replace(',', '.');
    } else if (canonical.includes(',') && !canonical.includes('.')) {
      canonical = canonical.replace(',', '.');
    }
    const parsed = Number(canonical);
    return Number.isFinite(parsed) ? parsed : undefined;
  };

  const handleSubmit = () => {
    if (!form.name.trim() || !form.type.trim()) {
      return;
    }

    const payload: AccountPayload = {
      name: form.name.trim(),
      type: form.type.trim(),
      initialBalance: parseAmount(form.initialBalance),
    };

    dispatch('submit', payload);
  };
</script>

{#if open}
  <div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
    <button
      type="button"
      class="absolute inset-0 cursor-default"
      aria-label="Close account modal"
      on:click={close}
    ></button>

    <div class="relative z-[121] w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-slate-900/70">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-slate-100">{account ? 'Edit Account' : 'New Account'}</h2>
          <p class="text-xs text-slate-500">Keep balances up to date across your financial sources.</p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
          on:click={close}
          disabled={isSaving}
        >
          Close
        </button>
      </div>

      <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-200" for="account-name">Name</label>
          <input
            id="account-name"
            class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            placeholder="Checking account"
            bind:value={form.name}
            required
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-200" for="account-type">Type</label>
          <input
            id="account-type"
            class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            placeholder="checking, savings, credit card"
            bind:value={form.type}
            required
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-200" for="account-initial">Initial balance</label>
          <input
            id="account-initial"
            class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            type="number"
            min="0"
            step="0.01"
            bind:value={form.initialBalance}
            placeholder="0.00"
          />
        </div>

        <div class="flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
            on:click={close}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSaving || !form.name.trim() || !form.type.trim()}
          >
            {isSaving ? 'Saving...' : account ? 'Save changes' : 'Create account'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
