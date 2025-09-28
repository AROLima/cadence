<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    type FinanceAccount,
    type FinanceCategoryNode,
    type Transaction,
    type TransactionPayload,
    type TransactionType,
  } from '$lib/types/finance';

  const TRANSACTION_TYPES: TransactionType[] = ['EXPENSE', 'INCOME', 'TRANSFER'];

  export let open = false;
  export let transaction: Transaction | null = null;
  export let accounts: FinanceAccount[] = [];
  export let categories: FinanceCategoryNode[] = [];
  export let isSaving = false;

  const dispatch = createEventDispatcher<{
    close: void;
    submit: TransactionPayload;
  }>();

  type FormState = {
    type: TransactionType;
    accountId: number | null;
    targetAccountId: number | null;
    categoryId: number | null;
    amount: string;
    occurredAt: string;
    notes: string;
    tags: string;
    attachmentUrl: string;
    installmentsTotal: string;
    installmentNumber: string;
    recurrenceRRule: string;
  };

  const today = new Date();
  const defaultDate = today.toISOString().slice(0, 10);

  let form: FormState = {
    type: 'EXPENSE',
    accountId: null,
    targetAccountId: null,
    categoryId: null,
    amount: '',
    occurredAt: defaultDate,
    notes: '',
    tags: '',
    attachmentUrl: '',
    installmentsTotal: '',
    installmentNumber: '',
    recurrenceRRule: '',
  };

  let internalKey: string | null = null;

  const flattenCategories = (nodes: FinanceCategoryNode[], depth = 0): { id: number; name: string }[] => {
    return nodes.flatMap((node) => {
      const prefix = depth ? `${'\u00A0'.repeat(depth * 2)}- ` : '';
      const current = [{ id: node.id, name: `${prefix}${node.name}` }];
      const children = node.children ? flattenCategories(node.children, depth + 1) : [];
      return [...current, ...children];
    });
  };

  $: categoryOptions = flattenCategories(categories ?? []);

  const hydrateFromTransaction = (value: Transaction) => {
    form = {
      type: value.type,
      accountId: value.accountId,
      targetAccountId: value.transferAccountId ?? null,
      categoryId: value.categoryId ?? null,
      amount: value.amount ? value.amount.toFixed(2) : '',
      occurredAt: value.occurredAt ? value.occurredAt.slice(0, 10) : defaultDate,
      notes: value.notes ?? '',
      tags: value.tags?.join(', ') ?? '',
      attachmentUrl: value.attachmentUrl ?? '',
      installmentsTotal: value.installmentsTotal ? String(value.installmentsTotal) : '',
      installmentNumber: value.installmentNumber ? String(value.installmentNumber) : '',
      recurrenceRRule: value.recurrenceRRule ?? '',
    };
  };

  const resetForm = () => {
    form = {
      type: 'EXPENSE',
      accountId: accounts[0]?.id ?? null,
      targetAccountId: null,
      categoryId: null,
      amount: '',
      occurredAt: defaultDate,
      notes: '',
      tags: '',
      attachmentUrl: '',
      installmentsTotal: '',
      installmentNumber: '',
      recurrenceRRule: '',
    };
  };

  const computeKey = () => {
    if (!open) return null;
    if (transaction) {
      return `tx-${transaction.id}`;
    }
    return 'create';
  };

  $: currentKey = computeKey();
  $: if (open) {
    if (currentKey !== internalKey) {
      if (transaction) {
        hydrateFromTransaction(transaction);
      } else {
        resetForm();
      }
      internalKey = currentKey;
    }
  } else if (internalKey) {
    internalKey = null;
  }

  const close = () => {
    if (isSaving) return;
    dispatch('close');
  };

  const parseNumberOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const trimmed = String(value).trim();
    // Handle locale formats like 20.000,50 (pt-BR) and 20,000.50 (en-US)
    const hasDot = trimmed.includes('.');
    const hasComma = trimmed.includes(',');
    let canonical = trimmed;
    if (hasDot && hasComma) {
      // Assume dot is thousand sep and comma is decimal: remove dots, replace comma with dot
      canonical = canonical.replace(/\./g, '').replace(',', '.');
    } else if (hasComma && !hasDot) {
      canonical = canonical.replace(',', '.');
    }
    // Remove spacing groupings (e.g., 20 000,50)
    canonical = canonical.replace(/\s+/g, '');
    const parsed = Number(canonical);
    return Number.isFinite(parsed) ? parsed : null;
  };

  const toIsoDateFromInput = (input: string | null | undefined): string => {
    if (!input) return new Date().toISOString();
    const raw = String(input).trim();
    // yyyy-mm-dd (HTML date input value)
    const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymd) {
      const [, y, m, d] = ymd;
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).toISOString();
    }
    // dd/mm/yyyy (common locale display)
    const cleaned = raw.replace(/\s/g, '');
    const dmy = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).toISOString();
    }
    // Fallback to Date.parse
    const t = Date.parse(raw);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
    return new Date().toISOString();
  };

  const parseIntegerOrNull = (value: unknown): number | null => {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') {
      return Number.isInteger(value) ? value : null;
    }
    const parsed = Number(String(value).trim());
    return Number.isFinite(parsed) && Number.isInteger(parsed) ? parsed : null;
  };

  const coerceInt = (value: unknown): number | undefined => {
    if (value === undefined || value === null || value === '' || value === 'null') {
      return undefined;
    }
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };

  const preparePayload = (): TransactionPayload | null => {
    const accountId = coerceInt(form.accountId);
    if (!accountId) {
      return null;
    }
    const amount = parseNumberOrNull(form.amount);
    if (!amount || amount <= 0) {
      return null;
    }

    const tags = form.tags
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);

    const occurredAtIso = toIsoDateFromInput(form.occurredAt);

    const categoryId = form.type === 'TRANSFER' ? undefined : coerceInt(form.categoryId);
    const targetAccountId = form.type === 'TRANSFER' ? coerceInt(form.targetAccountId) : undefined;
    const installmentsTotal = form.type === 'TRANSFER' ? undefined : parseIntegerOrNull(form.installmentsTotal) ?? undefined;
    const installmentNumber = form.type === 'TRANSFER' ? undefined : parseIntegerOrNull(form.installmentNumber) ?? undefined;

    const payload: TransactionPayload = {
      type: form.type,
      accountId,
      amount,
      occurredAt: occurredAtIso,
      notes: form.notes.trim() || undefined,
      tags,
      attachmentUrl: form.attachmentUrl.trim() || undefined,
      recurrenceRRule: form.recurrenceRRule.trim() || undefined,
      categoryId,
      targetAccountId,
      installmentsTotal,
      installmentNumber,
    };

    return payload;
  };

  const handleSubmit = () => {
    try {
      const payload = preparePayload();
      if (!payload) {
        console.error('[transaction-modal] invalid payload', { form });
        return;
      }
      dispatch('submit', payload);
    } catch (e) {
      console.error('[transaction-modal] submit failed', e);
    }
  };

  const availableTargetAccounts = accounts.filter((acc) => acc.id !== form.accountId);
</script>



{#if open}
  <div class="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm px-4">
    <button
      type="button"
      class="absolute inset-0 cursor-default"
      aria-label="Close transaction modal"
      on:click={close}
    ></button>

    <div class="relative z-[111] w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-slate-900/70">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-slate-100">{transaction ? 'Edit Transaction' : 'New Transaction'}</h2>
          <p class="text-xs text-slate-500">Track income, expenses, transfers and recurring payments.</p>
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

      <form class="space-y-6" on:submit|preventDefault={handleSubmit}>
        <div class="grid gap-3 sm:grid-cols-3">
          {#each TRANSACTION_TYPES as typeOption}
            <button
              type="button"
              class={`rounded-lg border px-3 py-2 text-sm transition ${
                form.type === typeOption
                  ? 'border-indigo-500 bg-indigo-500/20 text-indigo-100'
                  : 'border-slate-800 bg-slate-900/70 text-slate-300 hover:border-slate-600 hover:text-white'
              }`}
              on:click={() => {
                form = { ...form, type: typeOption };
                if (typeOption === 'TRANSFER') {
                  form.categoryId = null;
                }
              }}
            >
              {typeOption.toLowerCase()}
            </button>
          {/each}
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-200" for="transaction-account">Account</label>
            <select
              id="transaction-account"
              class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              bind:value={form.accountId}
            >
              <option value="" disabled selected={!form.accountId}>Select account</option>
              {#each accounts as account}
                <option value={String(account.id)}>{account.name}</option>
              {/each}
            </select>
          </div>

          {#if form.type === 'TRANSFER'}
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-200" for="transaction-target-account">Target account</label>
              <select
                id="transaction-target-account"
                class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                bind:value={form.targetAccountId}
              >
                <option value="" disabled selected={!form.targetAccountId}>Select target account</option>
                {#each availableTargetAccounts as account}
                  <option value={String(account.id)}>{account.name}</option>
                {/each}
              </select>
            </div>
          {:else}
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-200" for="transaction-category">Category</label>
              <select
                id="transaction-category"
                class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                bind:value={form.categoryId}
              >
                <option value="" disabled selected={!form.categoryId}>Select category</option>
                {#each categoryOptions as option}
                  <option value={String(option.id)}>{option.name}</option>
                {/each}
              </select>
            </div>
          {/if}
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-200" for="transaction-amount">Amount</label>
            <input
              id="transaction-amount"
              class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              type="number"
              min="0"
              step="0.01"
              bind:value={form.amount}
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-200" for="transaction-date">Date</label>
            <input
              id="transaction-date"
              class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              type="date"
              bind:value={form.occurredAt}
            />
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-200" for="transaction-notes">Description / notes</label>
          <textarea
            id="transaction-notes"
            class="min-h-[90px] w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            placeholder="Add context, vendor, invoice number..."
            bind:value={form.notes}
          ></textarea>
        </div>

        <div class="grid gap-4 sm:grid-cols-3">
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-200" for="transaction-tags">Tags</label>
            <input
              id="transaction-tags"
              class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              placeholder="Comma separated"
              bind:value={form.tags}
            />
          </div>
          <div class="space-y-2">
            <label class="text-sm font-medium text-slate-200" for="transaction-attachment">Attachment URL</label>
            <input
              id="transaction-attachment"
              class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              placeholder="https://"
              bind:value={form.attachmentUrl}
              type="url"
            />
          </div>
          {#if form.type !== 'TRANSFER'}
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-200" for="transaction-rrule">Recurrence (RRULE)</label>
              <input
                id="transaction-rrule"
                class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                placeholder="FREQ=MONTHLY;COUNT=12"
                bind:value={form.recurrenceRRule}
              />
            </div>
          {/if}
        </div>

        {#if form.type !== 'TRANSFER'}
          <div class="grid gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-200" for="transaction-installments-total">Installments</label>
              <input
                id="transaction-installments-total"
                class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                type="number"
                min="1"
                bind:value={form.installmentsTotal}
                placeholder="Total installments"
              />
            </div>
            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-200" for="transaction-installment-number">Installment number</label>
              <input
                id="transaction-installment-number"
                class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                type="number"
                min="1"
                bind:value={form.installmentNumber}
                placeholder="Current installment"
              />
            </div>
          </div>
        {/if}

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
            disabled={isSaving || !form.accountId || !form.amount || (form.type === 'TRANSFER' && !form.targetAccountId)}
          >
            {isSaving ? 'Saving...' : transaction ? 'Save changes' : 'Create transaction'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

