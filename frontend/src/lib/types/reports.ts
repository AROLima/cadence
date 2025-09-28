export interface TasksProductivity {
  daily: Array<{ date: string; completed: number }>;
  averageLeadTimeHours: number;
}

export interface FinanceMonthlyPoint {
  period: string;
  income: number;
  expense: number;
  net: number;
}

export interface ExpenseByCategory {
  categoryId: number | null;
  categoryName: string;
  amount: number;
}

export interface AccountBalanceSummary {
  accountId: number;
  name: string;
  type: string;
  initialBalance: number;
  totals: {
    income: number;
    expense: number;
    transferIn: number;
    transferOut: number;
    transferNet: number;
  };
  balance: number;
}
