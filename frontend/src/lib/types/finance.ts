export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER';
export type TransactionGroupType = 'TRANSFER';
export type TransferDirection = 'IN' | 'OUT';

export interface AccountTotals {
  income: number;
  expense: number;
  transferIn: number;
  transferOut: number;
  transferNet: number;
}

export interface FinanceAccount {
  id: number;
  name: string;
  type: string;
  initialBalance: number;
  balance: number;
  totals: AccountTotals;
  createdAt: string;
}

export interface FinanceCategoryNode {
  id: number;
  name: string;
  parentId: number | null;
  children: FinanceCategoryNode[];
}

export interface Transaction {
  id: number;
  groupId: string | null;
  groupType: TransactionGroupType | null;
  type: TransactionType;
  amount: number;
  occurredAt: string;
  accountId: number;
  accountName: string;
  transferAccountId: number | null;
  transferAccountName: string | null;
  transferDirection: TransferDirection | null;
  categoryId: number | null;
  categoryName: string | null;
  notes: string | null;
  tags: string[];
  attachmentUrl: string | null;
  installmentsTotal: number | null;
  installmentNumber: number | null;
  recurrenceRRule: string | null;
}

export interface PaginatedTransactions {
  items: Transaction[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    [key: string]: unknown;
  };
}

export interface TransactionFilters {
  type?: TransactionType[];
  accountId?: number;
  categoryId?: number;
  from?: string | null;
  to?: string | null;
  minAmount?: number;
  maxAmount?: number;
  q?: string;
}

export interface TransactionPayload {
  type: TransactionType;
  accountId: number;
  targetAccountId?: number | null;
  categoryId?: number | null;
  amount: number;
  occurredAt: string;
  notes?: string | null;
  tags?: string[];
  attachmentUrl?: string | null;
  installmentsTotal?: number | null;
  installmentNumber?: number | null;
  recurrenceRRule?: string | null;
}


export interface AccountPayload {
  name: string;
  type: string;
  initialBalance?: number | null;
}

export interface CategoryPayload {
  name: string;
  parentId?: number | null;
}

