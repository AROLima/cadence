<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import TransactionModal from '$lib/ui/TransactionModal.svelte';
  import { toasts } from '$lib/ui/toast';
  import {
    listAccounts,
    getCategoryTree,
    listTransactions,
    createTransaction,
    exportTransactionsCsv,
  } from '$lib/api/finance';
  import { getMySettings } from '$lib/api/me';
  import type {
    FinanceAccount,
    FinanceCategoryNode,
    Transaction,
    TransactionFilters,
    TransactionPayload,
    TransactionType,
  } from '$lib/types/finance';
  import { getCurrencyOptions } from '$lib/utils/currency';

  const TRANSACTION_TYPES: TransactionType[] = ['EXPENSE', 'INCOME', 'TRANSFER'];

  let loading = false;
  let exporting = false;
  let error: string | null = null;
  let accounts: FinanceAccount[] = [];
  let categories: FinanceCategoryNode[] = [];
  let transactions: Transaction[] = [];

  let page = 1;
  let pageSize = 20;
  let pageCount = 1;
  let total = 0;

  let selectedAccountId: number | '' = '';
  let selectedCategoryId: number | '' = '';
  let typeFilter: TransactionType[] = [];
  let fromDate = '';
  let toDate = '';
  let search = '';

  let modalOpen = false;
  let modalSaving = false;
  let showFilters = false;

  let locale = browser ? navigator.language : 'en-US';
  let currency = 'USD';
  const currencyOptions = getCurrencyOptions();
  let currencyName = 'USD';
  let currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });

  const flattenCategories = (nodes: FinanceCategoryNode[], depth = 0): { id: number; name: string }[] => {
    return nodes.flatMap((node) => {
      const prefix = depth ? `${'\u00A0'.repeat(depth * 2)}- ` : '';
      const current = [{ id: node.id, name: `${prefix}${node.name}` }];
      const children = node.children ? flattenCategories(node.children, depth + 1) : [];
      return [...current, ...children];
    });
  };

  $: categoryOptions = flattenCategories(categories ?? []);

  onMount(async () => {
    // Load user settings to honor locale and currency
    try {
      const my = await getMySettings();
      if (my?.locale) locale = my.locale;
  if (my?.currency) currency = my.currency;
  const opt = currencyOptions.find((c) => c.code === currency);
  currencyName = opt ? `${opt.code} – ${opt.symbol} ${opt.name}` : currency;
      currencyFormatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
      });
    } catch (e) {
      // ignore, use defaults
    }
    await Promise.all([loadAccounts(), loadCategories()]);
    void loadTransactions(true);
  });

  async function loadAccounts() {
    try {
      accounts = await listAccounts();
    } catch (err) {
      console.error('[transactions] failed to load accounts', err);
      toasts.push({ title: 'Accounts', description: 'Failed to load accounts.', variant: 'error' });
    }
  }

  async function loadCategories() {
    try {
      categories = await getCategoryTree();
    } catch (err) {
      console.error('[transactions] failed to load categories', err);
      toasts.push({ title: 'Categories', description: 'Failed to load categories.', variant: 'error' });
    }
  }

  const buildFilters = (): TransactionFilters => {
    const filters: TransactionFilters = {};
    if (selectedAccountId) {
      filters.accountId = Number(selectedAccountId);
    }
    if (selectedCategoryId) {
      filters.categoryId = Number(selectedCategoryId);
    }
    if (typeFilter.length) {
      filters.type = [...typeFilter];
    }
    if (fromDate) {
      filters.from = new Date(`${fromDate}T00:00:00`).toISOString();
    }
    if (toDate) {
      filters.to = new Date(`${toDate}T23:59:59`).toISOString();
    }
    if (search.trim()) {
      filters.q = search.trim();
    }
    return filters;
  };

  async function loadTransactions(resetPage = false) {
    if (resetPage) {
      page = 1;
    }
    loading = true;
    error = null;

    try {
      const result = await listTransactions(buildFilters(), { page, pageSize });
      transactions = result.items;
      page = result.meta.page ?? page;
      pageSize = result.meta.pageSize ?? pageSize;
      pageCount = result.meta.pageCount ?? 1;
      total = result.meta.total ?? result.items.length;
    } catch (err) {
      console.error('[transactions] failed to load list', err);
      error = err instanceof Error ? err.message : 'Failed to load transactions';
      toasts.push({ title: 'Transactions', description: error, variant: 'error' });
    } finally {
      loading = false;
    }
  }

  const toggleTypeFilter = (type: TransactionType) => {
    typeFilter = typeFilter.includes(type)
      ? typeFilter.filter((value) => value !== type)
      : [...typeFilter, type];
  };

  const resetFilters = () => {
    selectedAccountId = '';
    selectedCategoryId = '';
    typeFilter = [];
    fromDate = '';
    toDate = '';
    search = '';
    void loadTransactions(true);
  };

  const applyFilters = () => {
    void loadTransactions(true);
  };

  const changePage = (direction: 1 | -1) => {
    const next = page + direction;
    if (next < 1 || next > pageCount) {
      return;
    }
    page = next;
    void loadTransactions();
  };

  const formatAmount = (transaction: Transaction) => {
    const sign =
      transaction.type === 'EXPENSE' ||
      (transaction.type === 'TRANSFER' && transaction.transferDirection === 'OUT')
        ? -1
        : 1;
    const value = sign * transaction.amount;
    return currencyFormatter.format(value);
  };

  const amountClass = (transaction: Transaction) => {
    if (transaction.type === 'EXPENSE' || (transaction.type === 'TRANSFER' && transaction.transferDirection === 'OUT')) {
      return 'text-red-600 dark:text-red-300';
    }
    if (transaction.type === 'INCOME' || (transaction.type === 'TRANSFER' && transaction.transferDirection === 'IN')) {
      return 'text-emerald-600 dark:text-emerald-300';
    }
    return 'text-slate-700 dark:text-slate-200';
  };

  const openModal = () => {
    modalOpen = true;
  };

  const closeModal = () => {
    if (modalSaving) return;
    modalOpen = false;
  };

  const handleCreate = async (event: CustomEvent<TransactionPayload>) => {
    modalSaving = true;
    try {
      await createTransaction(event.detail);
      toasts.push({ title: 'Transaction saved', variant: 'success' });
      modalOpen = false;
      await loadTransactions(true);
    } catch (err) {
      console.error('[transactions] failed to create', err);
      const message = err instanceof Error ? err.message : 'Failed to create transaction';
      toasts.push({ title: 'Save failed', description: message, variant: 'error' });
    } finally {
      modalSaving = false;
    }
  };

  const handleExportCsv = async () => {
    exporting = true;
    try {
      const blob = await exportTransactionsCsv(buildFilters());
      if (!browser) {
        toasts.push({ title: 'Export unavailable', description: 'CSV export requires a browser.', variant: 'error' });
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toasts.push({ title: 'Export complete', description: 'Download started.', variant: 'success' });
    } catch (err) {
      console.error('[transactions] export failed', err);
      const message = err instanceof Error ? err.message : 'Failed to export transactions';
      toasts.push({ title: 'Export failed', description: message, variant: 'error' });
    } finally {
      exporting = false;
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
  <h2 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Transactions</h2>
  <p class="text-sm text-slate-600 dark:text-slate-400">Filter by account, category, type, and export finance data.</p>
    </div>
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
  class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition disabled:opacity-60 border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
        on:click={handleExportCsv}
        disabled={exporting || loading}
      >
        {exporting ? 'Exporting...' : 'Export CSV'}
      </button>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
        on:click={openModal}
      >
        New transaction
      </button>
    </div>
  </div>

  <form class="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60" on:submit|preventDefault={applyFilters}>
    <div class="flex items-center justify-between sm:hidden">
  <p class="text-sm text-slate-600 dark:text-slate-300">Filters</p>
      <button
        type="button"
  class={`rounded-lg border px-3 py-1.5 text-xs transition ${showFilters ? 'border-indigo-500 text-indigo-700 dark:text-indigo-200' : 'border-slate-300 text-slate-700 dark:border-slate-700 dark:text-slate-300'}`}
        on:click={() => (showFilters = !showFilters)}
      >
        {showFilters ? 'Hide' : 'Show'}
      </button>
    </div>
    <div class={`space-y-4 ${showFilters ? '' : 'sm:space-y-0 sm:block hidden'}`}>
    <div class="grid gap-4 md:grid-cols-5">
      <div class="space-y-2">
  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400" for="filter-account">Account</label>
        <select
          id="filter-account"
          class="w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
          bind:value={selectedAccountId}
        >
          <option value="">All accounts</option>
          {#each accounts as account}
            <option value={account.id}>{account.name}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-2">
  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400" for="filter-category">Category</label>
        <select
          id="filter-category"
          class="w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
          bind:value={selectedCategoryId}
        >
          <option value="">All categories</option>
          {#each categoryOptions as option}
            <option value={option.id}>{option.name}</option>
          {/each}
        </select>
      </div>
      <div class="space-y-2">
  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400" for="filter-from">From</label>
        <input
          id="filter-from"
          type="date"
          class="w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
          bind:value={fromDate}
        />
      </div>
      <div class="space-y-2">
  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400" for="filter-to">To</label>
        <input
          id="filter-to"
          type="date"
          class="w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
          bind:value={toDate}
        />
      </div>
      <div class="space-y-2">
  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400" for="filter-search">Search</label>
        <input
          id="filter-search"
          class="w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
          placeholder="Notes, account, tags"
          bind:value={search}
        />
      </div>
    </div>

    <div class="space-y-3">
  <p class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Type</p>
      <div class="flex flex-wrap gap-2">
        {#each TRANSACTION_TYPES as typeOption}
          <button
            type="button"
            class={`rounded-full px-3 py-1 text-xs font-medium transition ${
              typeFilter.includes(typeOption)
                ? 'bg-indigo-500 text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
            on:click={() => toggleTypeFilter(typeOption)}
          >
            {typeOption.toLowerCase()}
          </button>
        {/each}
      </div>
    </div>

  <div class="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:justify-end dark:border-slate-800">
      <button
        type="button"
  class="rounded-lg border px-4 py-2 text-sm transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
        on:click={resetFilters}
      >
        Reset filters
      </button>
      <button
        type="submit"
        class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
      >
        Apply filters
      </button>
    </div>
    </div>
  </form>

  <div class="overflow-x-auto rounded-xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/60">
    {#if loading}
  <div class="flex items-center justify-center px-6 py-16 text-sm text-slate-600 dark:text-slate-400">Loading transactions...</div>
    {:else if error}
      <div class="space-y-3 px-6 py-12 text-center">
  <p class="text-sm text-red-600 dark:text-red-300">{error}</p>
        <button
          type="button"
          class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
          on:click={() => loadTransactions()}
        >
          Try again
        </button>
      </div>
    {:else if transactions.length === 0}
  <div class="px-6 py-16 text-center text-sm text-slate-600 dark:text-slate-400">No transactions yet. Adjust filters or create a new one.</div>
    {:else}
      <table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-950/80 dark:text-slate-400">
          <tr>
            <th class="px-4 py-3 text-left">Date</th>
            <th class="px-4 py-3 text-left">Description</th>
            <th class="px-4 py-3 text-left hidden sm:table-cell">Category</th>
            <th class="px-4 py-3 text-left hidden md:table-cell">Account</th>
            <th class="px-4 py-3 text-left">Amount <span title={currencyName} class="text-[10px] text-slate-500 align-middle">({currency})</span></th>
          </tr>
        </thead>
  <tbody class="divide-y divide-slate-200 dark:divide-slate-900/70">
          {#each transactions as transaction (transaction.id)}
            <tr>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-200">{formatDate(transaction.occurredAt)}</td>
              <td class="px-4 py-3">
                <div class="text-slate-900 dark:text-slate-100">{transaction.notes ?? '(No description)'}</div>
                {#if transaction.tags.length}
                  <div class="mt-1 text-xs text-slate-500">{transaction.tags.join(', ')}</div>
                {/if}
              </td>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-200 hidden sm:table-cell">{transaction.categoryName ?? (transaction.type === 'TRANSFER' ? 'Transfer' : 'Uncategorised')}</td>
              <td class="px-4 py-3 text-slate-700 dark:text-slate-200 hidden md:table-cell">
                <div>{transaction.accountName}</div>
                {#if transaction.transferAccountName}
                  <div class="text-xs text-slate-500">→ {transaction.transferAccountName}</div>
                {/if}
              </td>
              <td class={`px-4 py-3 text-right font-semibold ${amountClass(transaction)}`} title={currencyName}>
                {formatAmount(transaction)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>

  {#if !loading && pageCount > 1}
  <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
      <span>Showing page {page} of {pageCount}  -  {total} transactions</span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border px-3 py-1.5 text-xs transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
          on:click={() => changePage(-1)}
          disabled={page === 1}
        >
          Previous
        </button>
        <button
          type="button"
          class="rounded-lg border px-3 py-1.5 text-xs transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-50 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
          on:click={() => changePage(1)}
          disabled={page === pageCount}
        >
          Next
        </button>
      </div>
    </div>
  {/if}
</div>

<TransactionModal
  open={modalOpen}
  accounts={accounts}
  categories={categories}
  transaction={null}
  isSaving={modalSaving}
  on:close={closeModal}
  on:submit={handleCreate}
/>

