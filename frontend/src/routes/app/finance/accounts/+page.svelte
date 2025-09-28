<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import AccountModal from '$lib/ui/AccountModal.svelte';
  import { toasts } from '$lib/ui/toast';
  import {
    listAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
  } from '$lib/api/finance';
  import type { FinanceAccount, AccountPayload } from '$lib/types/finance';

  let loading = false;
  let error: string | null = null;
  let accounts: FinanceAccount[] = [];

  let modalOpen = false;
  let modalSaving = false;
  let editingAccount: FinanceAccount | null = null;

  const locale = browser ? navigator.language : 'en-US';
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });

  const formatAmount = (value: number) => currencyFormatter.format(Number.isFinite(value) ? value : 0);

  // Derive totals reactively to avoid any stale evaluations
  $: totalBalanceValue = accounts.reduce((sum, account) => sum + (account.balance ?? 0), 0);
  $: totalIncomeValue = accounts.reduce((sum, account) => sum + (account.totals?.income ?? 0), 0);
  $: totalExpenseValue = accounts.reduce((sum, account) => sum + (account.totals?.expense ?? 0), 0);

  onMount(() => {
    void loadAccounts();
  });

  async function loadAccounts() {
    loading = true;
    error = null;
    try {
      accounts = await listAccounts();
    } catch (err) {
      console.error('[accounts] failed to load', err);
      error = err instanceof Error ? err.message : 'Failed to load accounts';
      toasts.push({ title: 'Accounts', description: error, variant: 'error' });
    } finally {
      loading = false;
    }
  }

  const openCreate = () => {
    editingAccount = null;
    modalOpen = true;
  };

  const openEdit = (account: FinanceAccount) => {
    editingAccount = account;
    modalOpen = true;
  };

  const closeModal = () => {
    if (modalSaving) return;
    modalOpen = false;
    editingAccount = null;
  };

  const handleSubmit = async (event: CustomEvent<AccountPayload>) => {
    modalSaving = true;
    try {
      if (editingAccount) {
        await updateAccount(editingAccount.id, event.detail);
        toasts.push({ title: 'Account updated', variant: 'success' });
      } else {
        await createAccount(event.detail);
        toasts.push({ title: 'Account created', variant: 'success' });
      }
      modalOpen = false;
      editingAccount = null;
      await loadAccounts();
    } catch (err) {
      console.error('[accounts] save failed', err);
      const message = err instanceof Error ? err.message : 'Failed to save account';
      toasts.push({ title: 'Save failed', description: message, variant: 'error' });
    } finally {
      modalSaving = false;
    }
  };

  const handleDelete = async (account: FinanceAccount) => {
    const confirmed = window.confirm(`Delete account "${account.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    try {
      await deleteAccount(account.id);
      toasts.push({ title: 'Account deleted', variant: 'success' });
      await loadAccounts();
    } catch (err) {
      console.error('[accounts] delete failed', err);
      const message = err instanceof Error ? err.message : 'Failed to delete account';
      toasts.push({ title: 'Delete failed', description: message, variant: 'error' });
    }
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };
</script>

<div class="space-y-6">
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 class="text-2xl font-semibold text-slate-100">Accounts</h2>
      <p class="text-sm text-slate-400">Keep track of balances across banks, cards, and cash.</p>
    </div>
    <button
      type="button"
      class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
      on:click={openCreate}
    >
      New account
    </button>
  </div>

  <div class="grid gap-4 sm:grid-cols-3">
    <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p class="text-xs uppercase tracking-wide text-slate-400">Total balance</p>
      <p class="mt-2 text-2xl font-semibold text-slate-100">{formatAmount(totalBalanceValue)}</p>
    </div>
    <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p class="text-xs uppercase tracking-wide text-slate-400">Total income</p>
      <p class="mt-2 text-2xl font-semibold text-emerald-300">{formatAmount(totalIncomeValue)}</p>
    </div>
    <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p class="text-xs uppercase tracking-wide text-slate-400">Total expense</p>
      <p class="mt-2 text-2xl font-semibold text-red-300">{formatAmount(totalExpenseValue)}</p>
    </div>
  </div>

  <div class="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
    {#if loading}
      <div class="flex items-center justify-center px-6 py-16 text-sm text-slate-400">Loading accounts...</div>
    {:else if error}
      <div class="space-y-3 px-6 py-12 text-center">
        <p class="text-sm text-red-300">{error}</p>
        <button
          type="button"
          class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
          on:click={() => loadAccounts()}
        >
          Try again
        </button>
      </div>
    {:else if accounts.length === 0}
      <div class="px-6 py-16 text-center text-sm text-slate-400">No accounts yet. Add your first account to start tracking balances.</div>
    {:else}
      <table class="min-w-full divide-y divide-slate-800 text-sm">
        <thead class="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th class="px-4 py-3 text-left">Name</th>
            <th class="px-4 py-3 text-left hidden sm:table-cell">Type</th>
            <th class="px-4 py-3 text-left hidden md:table-cell">Initial</th>
            <th class="px-4 py-3 text-left">Balance</th>
            <th class="px-4 py-3 text-left hidden md:table-cell">Income</th>
            <th class="px-4 py-3 text-left hidden md:table-cell">Expense</th>
            <th class="px-4 py-3 text-left hidden lg:table-cell">Updated</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-900/70">
          {#each accounts as account (account.id)}
            <tr>
              <td class="px-4 py-3 text-slate-100">{account.name}</td>
              <td class="px-4 py-3 text-slate-300 hidden sm:table-cell">{account.type}</td>
              <td class="px-4 py-3 text-slate-200 hidden md:table-cell">{formatAmount(account.initialBalance ?? 0)}</td>
              <td class="px-4 py-3 text-slate-200">{formatAmount(account.balance ?? 0)}</td>
              <td class="px-4 py-3 text-emerald-300 hidden md:table-cell">{formatAmount(account.totals?.income ?? 0)}</td>
              <td class="px-4 py-3 text-red-300 hidden md:table-cell">{formatAmount(account.totals?.expense ?? 0)}</td>
              <td class="px-4 py-3 text-slate-400 hidden lg:table-cell">{formatDate(account.createdAt)}</td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white"
                    on:click={() => openEdit(account)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-red-500/50 px-3 py-1 text-xs text-red-200 transition hover:border-red-400 hover:text-white"
                    on:click={() => handleDelete(account)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<AccountModal
  open={modalOpen}
  account={editingAccount}
  isSaving={modalSaving}
  on:close={closeModal}
  on:submit={handleSubmit}
/>
