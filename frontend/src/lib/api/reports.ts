import { apiFetch } from '$lib/utils/api';
import type {
  TasksProductivity,
  FinanceMonthlyPoint,
  ExpenseByCategory,
  AccountBalanceSummary,
} from '$lib/types/reports';

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

async function parseResponse<T>(response: Response, fallback: string): Promise<T> {
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

  return payload.data;
}

export async function fetchTasksProductivity(params: { from?: string; to?: string } = {}): Promise<TasksProductivity> {
  const search = new URLSearchParams();
  if (params.from) {
    search.set('from', params.from);
  }
  if (params.to) {
    search.set('to', params.to);
  }
  const query = search.toString();
  const response = await apiFetch(`/reports/tasks/productivity${query ? `?${query}` : ''}`);
  return parseResponse<TasksProductivity>(response, 'Failed to load productivity metrics');
}

export interface MonthlySeriesParams {
  fromMonth: number;
  fromYear: number;
  toMonth: number;
  toYear: number;
}

export async function fetchFinanceMonthlySeries(params: MonthlySeriesParams): Promise<FinanceMonthlyPoint[]> {
  const search = new URLSearchParams({
    fromMonth: String(params.fromMonth),
    fromYear: String(params.fromYear),
    toMonth: String(params.toMonth),
    toYear: String(params.toYear),
  });
  const response = await apiFetch(`/reports/finance/monthly-series?${search.toString()}`);
  return parseResponse<FinanceMonthlyPoint[]>(response, 'Failed to load finance monthly series');
}

export async function fetchExpensesByCategory(params: { month: number; year: number }): Promise<ExpenseByCategory[]> {
  const search = new URLSearchParams({
    month: String(params.month),
    year: String(params.year),
  });
  const response = await apiFetch(`/reports/finance/expenses-by-category?${search.toString()}`);
  return parseResponse<ExpenseByCategory[]>(response, 'Failed to load expenses by category');
}

export async function fetchAccountBalances(): Promise<AccountBalanceSummary[]> {
  const response = await apiFetch('/reports/finance/balance-by-account');
  return parseResponse<AccountBalanceSummary[]>(response, 'Failed to load account balances');
}
