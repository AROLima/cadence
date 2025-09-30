import { apiFetch } from '$lib/utils/api';
import type {
  FinanceAccount,
  FinanceCategoryNode,
  PaginatedTransactions,
  Transaction,
  TransactionFilters,
  TransactionPayload,
  AccountPayload,
  CategoryPayload,
} from '$lib/types/finance';

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
  message?: string | string[];
}

function extractMessage(defaultMessage: string, payload?: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return defaultMessage;
  }
  const message = (payload as { message?: unknown }).message;
  if (!message) {
    return defaultMessage;
  }
  if (Array.isArray(message) && message.length > 0) {
    return String(message[0]);
  }
  return String(message);
}

async function parseResponse<T>(response: Response, fallback: string): Promise<{ data: T; meta?: unknown }> {
  let payload: ApiResponse<T> | undefined;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch (error) {
    if (!response.ok) {
      throw new Error(fallback);
    }
    throw error;
  }

  if (!response.ok || !payload?.success) {
    throw new Error(extractMessage(fallback, payload));
  }

  return { data: payload.data, meta: payload.meta };
}

export async function listAccounts(): Promise<FinanceAccount[]> {
  const response = await apiFetch('/finance/accounts');
  const { data } = await parseResponse<FinanceAccount[]>(response, 'Failed to load accounts');
  return data ?? [];
}

// Simple session cache with TTL and in-flight dedupe for category tree
let categoryTreeCache: { data: FinanceCategoryNode[]; exp: number } | null = null;
let categoryTreeInFlight: Promise<FinanceCategoryNode[]> | null = null;
const CATEGORY_TTL_MS = 60_000; // 1 minute

export async function getCategoryTree(): Promise<FinanceCategoryNode[]> {
  const now = Date.now();
  if (categoryTreeCache && categoryTreeCache.exp > now) {
    return categoryTreeCache.data;
  }
  if (categoryTreeInFlight) {
    return categoryTreeInFlight;
  }
  categoryTreeInFlight = (async () => {
    const response = await apiFetch('/finance/categories/tree');
    const { data } = await parseResponse<FinanceCategoryNode[]>(response, 'Failed to load categories');
    const safe = data ?? [];
    categoryTreeCache = { data: safe, exp: Date.now() + CATEGORY_TTL_MS };
    categoryTreeInFlight = null;
    return safe;
  })();
  return categoryTreeInFlight;
}

function buildQuery(filters: TransactionFilters = {}, pagination: PaginationInput = {}): string {
  const params = new URLSearchParams();

  if (pagination.page && pagination.page > 0) {
    params.set('page', String(pagination.page));
  }
  if (pagination.pageSize && pagination.pageSize > 0) {
    params.set('pageSize', String(pagination.pageSize));
  }

  filters.type?.forEach((value) => params.append('type', value));
  if (filters.accountId) {
    params.set('accountId', String(filters.accountId));
  }
  if (filters.categoryId) {
    params.set('categoryId', String(filters.categoryId));
  }
  if (filters.from) {
    params.set('from', filters.from);
  }
  if (filters.to) {
    params.set('to', filters.to);
  }
  if (filters.minAmount !== undefined) {
    params.set('minAmount', String(filters.minAmount));
  }
  if (filters.maxAmount !== undefined) {
    params.set('maxAmount', String(filters.maxAmount));
  }
  if (filters.q) {
    params.set('q', filters.q);
  }

  const query = params.toString();
  return query.length ? `?${query}` : '';
}

export async function listTransactions(
  filters: TransactionFilters = {},
  pagination: PaginationInput = {},
): Promise<PaginatedTransactions> {
  const response = await apiFetch(`/finance/transactions${buildQuery(filters, pagination)}`);
  const { data, meta } = await parseResponse<PaginatedTransactions>(response, 'Failed to load transactions');

  const payloadMeta = (meta ?? data?.meta ?? {}) as PaginatedTransactions['meta'];
  const fallbackPage = pagination.page ?? 1;
  const fallbackSize = (pagination.pageSize ?? (data?.items?.length ?? 0)) || 1;
  const totalItems = (payloadMeta.total as number | undefined) ?? data?.items?.length ?? 0;
  const safeMeta: PaginatedTransactions['meta'] = {
    ...payloadMeta,
    page: (payloadMeta.page as number | undefined) ?? fallbackPage,
    pageSize: (payloadMeta.pageSize as number | undefined) ?? fallbackSize,
    total: totalItems,
    pageCount:
      (payloadMeta.pageCount as number | undefined) ?? Math.max(1, Math.ceil(totalItems / fallbackSize)),
  };

  return {
    items: data?.items ?? [],
    meta: safeMeta,
  };
}

export async function createTransaction(payload: TransactionPayload): Promise<Transaction> {
  const response = await apiFetch('/finance/transactions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const { data } = await parseResponse<Transaction>(response, 'Failed to create transaction');
  return data;
}

export async function updateTransaction(id: number, payload: Partial<TransactionPayload>): Promise<Transaction> {
  const response = await apiFetch(`/finance/transactions/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const { data } = await parseResponse<Transaction>(response, 'Failed to update transaction');
  return data;
}

export async function deleteTransaction(id: number): Promise<void> {
  const response = await apiFetch(`/finance/transactions/${id}`, {
    method: 'DELETE',
  });
  await parseResponse<{ message?: string }>(response, 'Failed to delete transaction');
}

function toCsvValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  const text = String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export async function exportTransactionsCsv(
  filters: TransactionFilters = {},
): Promise<Blob> {
  const rows: Transaction[] = [];
  let currentPage = 1;
  let pageCount = 1;

  do {
    const result = await listTransactions(filters, { page: currentPage, pageSize: 200 });
    rows.push(...result.items);
    pageCount = result.meta.pageCount;
    currentPage += 1;
  } while (currentPage <= pageCount);

  const header = [
    'Date',
    'Type',
    'Description',
    'Category',
    'Account',
    'Transfer Account',
    'Amount',
    'Tags',
  ];

  const dataLines = rows.map((transaction) => {
    const line = [
      new Date(transaction.occurredAt).toISOString(),
      transaction.type,
      transaction.notes ?? '',
      transaction.categoryName ?? '',
      transaction.accountName,
      transaction.transferAccountName ?? '',
      transaction.amount.toFixed(2),
      transaction.tags.join('; '),
    ];
    return line.map(toCsvValue).join(',');
  });

  const csv = [header.map(toCsvValue).join(','), ...dataLines].join('\n');
  return new Blob([csv], { type: 'text/csv;charset=utf-8' });
}

export function buildTransferPayload(
  base: TransactionPayload,
  targetAccountId: number,
): TransactionPayload {
  if (base.type !== 'TRANSFER') {
    return base;
  }

  return {
    ...base,
    targetAccountId,
    recurrenceRRule: base.recurrenceRRule ?? null,
    installmentsTotal: base.installmentsTotal ?? null,
    installmentNumber: base.installmentNumber ?? null,
  };
}

export async function createAccount(payload: AccountPayload): Promise<FinanceAccount> {
  const response = await apiFetch('/finance/accounts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const { data } = await parseResponse<FinanceAccount>(response, 'Failed to create account');
  return data;
}

export async function updateAccount(id: number, payload: Partial<AccountPayload>): Promise<FinanceAccount> {
  const response = await apiFetch(`/finance/accounts/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const { data } = await parseResponse<FinanceAccount>(response, 'Failed to update account');
  return data;
}

export async function deleteAccount(id: number): Promise<void> {
  const response = await apiFetch(`/finance/accounts/${id}`, { method: 'DELETE' });
  await parseResponse<{ message?: string }>(response, 'Failed to delete account');
}

export async function createCategory(payload: CategoryPayload): Promise<FinanceCategoryNode> {
  const response = await apiFetch('/finance/categories', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const { data } = await parseResponse<FinanceCategoryNode>(response, 'Failed to create category');
  return data;
}

export async function updateCategory(id: number, payload: Partial<CategoryPayload>): Promise<FinanceCategoryNode> {
  const response = await apiFetch(`/finance/categories/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const { data } = await parseResponse<FinanceCategoryNode>(response, 'Failed to update category');
  return data;
}

export async function deleteCategory(id: number): Promise<void> {
  const response = await apiFetch(`/finance/categories/${id}`, { method: 'DELETE' });
  await parseResponse<{ message?: string }>(response, 'Failed to delete category');
}
