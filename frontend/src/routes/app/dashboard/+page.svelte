<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { browser } from '$app/environment';
  import {
    fetchTasksProductivity,
    fetchFinanceMonthlySeries,
    fetchExpensesByCategory,
    fetchAccountBalances,
  } from '$lib/api/reports';
  import type {
    TasksProductivity,
    FinanceMonthlyPoint,
    ExpenseByCategory,
    AccountBalanceSummary,
  } from '$lib/types/reports';

  let loading = true;
  let error: string | null = null;

  let tasksProductivity: TasksProductivity | null = null;
  let monthlySeries: FinanceMonthlyPoint[] = [];
  let expensesByCategory: ExpenseByCategory[] = [];
  let accountBalances: AccountBalanceSummary[] = [];

  let tasksCompleted30d = 0;
  let averageLeadTimeLabel = '--';
  let currentMonthExpenses = 0;
  let totalBalance = 0;

  const locale = browser ? navigator.language : 'en-US';
  const currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  });
  const numberFormatter = new Intl.NumberFormat(locale);

  let Chart: typeof import('chart.js/auto').default | null = null;
  let monthlyChart: import('chart.js/auto').Chart | null = null;
  let categoryChart: import('chart.js/auto').Chart | null = null;
  let burndownChart: import('chart.js/auto').Chart | null = null;

  let monthlyCanvas: HTMLCanvasElement | undefined;
  let categoryCanvas: HTMLCanvasElement | undefined;
  let burndownCanvas: HTMLCanvasElement | undefined;

  onMount(async () => {
    const now = new Date();
    try {
      const module = await import('chart.js/auto');
      Chart = module.default;
      await loadDashboard(now);
    } catch (err) {
      console.error('[dashboard] failed to initialise', err);
      error = err instanceof Error ? err.message : 'Failed to load dashboard';
    } finally {
      loading = false;
      updateCharts();
    }
  });

  onDestroy(() => {
    destroyCharts();
  });

  async function loadDashboard(referenceDate: Date) {
    try {
      loading = true;
      error = null;

      const to = new Date(referenceDate);
      const from = new Date(referenceDate);
      from.setDate(from.getDate() - 30);

      const productivityPromise = fetchTasksProductivity({
        from: from.toISOString(),
        to: to.toISOString(),
      });

      const endMonth = referenceDate.getUTCMonth();
      const endYear = referenceDate.getUTCFullYear();
      const startDate = new Date(Date.UTC(endYear, endMonth - 11, 1));

      const monthlySeriesPromise = fetchFinanceMonthlySeries({
        fromMonth: startDate.getUTCMonth() + 1,
        fromYear: startDate.getUTCFullYear(),
        toMonth: endMonth + 1,
        toYear: endYear,
      });

      const expensesPromise = fetchExpensesByCategory({
        month: endMonth + 1,
        year: endYear,
      });

      const balancesPromise = fetchAccountBalances();

      const results = await Promise.allSettled([
        productivityPromise,
        monthlySeriesPromise,
        expensesPromise,
        balancesPromise,
      ]);

      const [prodRes, monthlyRes, categoryRes, balanceRes] = results;

      const errors: string[] = [];
      if (prodRes.status === 'fulfilled') {
        tasksProductivity = prodRes.value;
      } else {
        errors.push('Tasks productivity');
        tasksProductivity = null;
      }
      if (monthlyRes.status === 'fulfilled') {
        monthlySeries = monthlyRes.value;
      } else {
        errors.push('Monthly series');
        monthlySeries = [];
      }
      if (categoryRes.status === 'fulfilled') {
        expensesByCategory = categoryRes.value;
      } else {
        errors.push('Expenses by category');
        expensesByCategory = [];
      }
      if (balanceRes.status === 'fulfilled') {
        accountBalances = balanceRes.value;
      } else {
        errors.push('Account balances');
        accountBalances = [];
      }

      if (errors.length && errors.length < results.length) {
        // Some parts failed but we can still render others
        console.warn('[dashboard] Partial data load failure:', errors.join(', '));
      } else if (errors.length === results.length) {
        throw new Error('Falha ao carregar os dados do dashboard');
      }

      computeKpis(referenceDate);
    } catch (err) {
      console.error('[dashboard] data fetch failed', err);
      error = err instanceof Error ? err.message : 'Failed to load dashboard data';
    }
  }

  function computeKpis(referenceDate: Date) {
    if (tasksProductivity) {
      tasksCompleted30d = tasksProductivity.daily.reduce(
        (total, item) => total + item.completed,
        0,
      );

      averageLeadTimeLabel = formatLeadTime(tasksProductivity.averageLeadTimeHours);
    } else {
      tasksCompleted30d = 0;
      averageLeadTimeLabel = '--';
    }

    currentMonthExpenses = expensesByCategory.reduce((sum, item) => sum + item.amount, 0);
    totalBalance = accountBalances.reduce((sum, item) => sum + (item.balance ?? 0), 0);

    buildChartData(referenceDate);
  }

  let monthlyChartData: { labels: string[]; datasets: { income: number[]; expense: number[]; net: number[] } } = {
    labels: [],
    datasets: { income: [], expense: [], net: [] },
  };

  let categoryChartData: { labels: string[]; values: number[] } = { labels: [], values: [] };

  let burndownChartData: { labels: string[]; remaining: number[]; ideal: number[] } = {
    labels: [],
    remaining: [],
    ideal: [],
  };

  function buildChartData(referenceDate: Date) {
    monthlyChartData = buildMonthlyChartData();
    categoryChartData = buildCategoryChartData();
    burndownChartData = buildBurndownData(referenceDate);
    updateCharts();
  }

  function buildMonthlyChartData() {
    if (!monthlySeries.length) {
      return { labels: [], datasets: { income: [], expense: [], net: [] } };
    }
    const labels = monthlySeries.map((point) => point.period);
    const income = monthlySeries.map((point) => point.income);
    const expense = monthlySeries.map((point) => point.expense);
    const net = monthlySeries.map((point) => point.net);
    return { labels, datasets: { income, expense, net } };
  }

  function buildCategoryChartData() {
    if (!expensesByCategory.length) {
      return { labels: [], values: [] };
    }
    const labels = expensesByCategory.map((item) => item.categoryName);
    const values = expensesByCategory.map((item) => item.amount);
    return { labels, values };
  }

  function buildBurndownData(referenceDate: Date) {
    if (!tasksProductivity) {
      return { labels: [], remaining: [], ideal: [] };
    }

    const dailyMap = new Map<string, number>();
    for (const entry of tasksProductivity.daily) {
      dailyMap.set(entry.date, entry.completed);
    }

    const labels: string[] = [];
    const dailyValues: number[] = [];
    const tempDate = new Date(referenceDate);
    tempDate.setHours(0, 0, 0, 0);

    for (let offset = 13; offset >= 0; offset--) {
      const day = new Date(tempDate);
      day.setDate(tempDate.getDate() - offset);
      const key = day.toISOString().slice(0, 10);
      labels.push(day.toLocaleDateString(locale, { month: 'short', day: 'numeric' }));
      dailyValues.push(dailyMap.get(key) ?? 0);
    }

    const totalCompleted = dailyValues.reduce((sum, value) => sum + value, 0);
    const remaining: number[] = [];
    let running = totalCompleted;
    remaining.push(running);
    for (const value of dailyValues) {
      running = Math.max(running - value, 0);
      remaining.push(running);
    }

    const ideal: number[] = [];
    const steps = remaining.length - 1;
    for (let index = 0; index < remaining.length; index++) {
      const factor = steps === 0 ? 0 : index / steps;
      ideal.push(totalCompleted - totalCompleted * factor);
    }

    const extendedLabels = ['Start', ...labels];

    return { labels: extendedLabels, remaining, ideal };
  }

  function updateCharts() {
    if (!Chart) {
      return;
    }
    updateMonthlyChart();
    updateCategoryChart();
    updateBurndownChart();
  }

  function updateMonthlyChart() {
    if (!Chart || !monthlyCanvas) {
      return;
    }
    if (monthlyChart) {
      monthlyChart.destroy();
      monthlyChart = null;
    }
    if (!monthlyChartData.labels.length) {
      return;
    }
    monthlyChart = new Chart(monthlyCanvas, {
      type: 'line',
      data: {
        labels: monthlyChartData.labels,
        datasets: [
          {
            label: 'Income',
            data: monthlyChartData.datasets.income,
            borderColor: 'rgba(34, 197, 94, 0.8)',
            backgroundColor: 'rgba(34, 197, 94, 0.2)',
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Expense',
            data: monthlyChartData.datasets.expense,
            borderColor: 'rgba(239, 68, 68, 0.8)',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Net',
            data: monthlyChartData.datasets.net,
            borderColor: 'rgba(59, 130, 246, 0.8)',
            backgroundColor: 'rgba(59, 130, 246, 0.2)',
            tension: 0.3,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#cbd5f5' } },
          tooltip: { mode: 'index', intersect: false },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
          },
          y: {
            ticks: {
              color: '#94a3b8',
              callback: (value) => currencyFormatter.format(Number(value)),
            },
            grid: { color: 'rgba(148, 163, 184, 0.1)' },
          },
        },
      },
    });
  }

  function updateCategoryChart() {
    if (!Chart || !categoryCanvas) {
      return;
    }
    if (categoryChart) {
      categoryChart.destroy();
      categoryChart = null;
    }
    if (!categoryChartData.labels.length) {
      return;
    }
    categoryChart = new Chart(categoryCanvas, {
      type: 'pie',
      data: {
        labels: categoryChartData.labels,
        datasets: [
          {
            data: categoryChartData.values,
            backgroundColor: categoryChartData.labels.map((_, index) =>
              `hsl(${(index * 47) % 360} 70% 55%)`,
            ),
            borderColor: '#0f172a',
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: '#cbd5f5' } },
        },
      },
    });
  }

  function updateBurndownChart() {
    if (!Chart || !burndownCanvas) {
      return;
    }
    if (burndownChart) {
      burndownChart.destroy();
      burndownChart = null;
    }
    if (!burndownChartData.labels.length) {
      return;
    }
    burndownChart = new Chart(burndownCanvas, {
      type: 'line',
      data: {
        labels: burndownChartData.labels,
        datasets: [
          {
            label: 'Remaining',
            data: burndownChartData.remaining,
            borderColor: 'rgba(239, 68, 68, 0.8)',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            tension: 0.3,
            fill: false,
          },
          {
            label: 'Ideal',
            data: burndownChartData.ideal,
            borderColor: 'rgba(148, 163, 184, 0.6)',
            borderDash: [6, 4],
            tension: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: '#cbd5f5' } },
        },
        scales: {
          x: {
            ticks: { color: '#94a3b8' },
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
          },
          y: {
            ticks: {
              color: '#94a3b8',
              callback: (value) => numberFormatter.format(Number(value)),
            },
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
          },
        },
      },
    });
  }

  function destroyCharts() {
    monthlyChart?.destroy();
    categoryChart?.destroy();
    burndownChart?.destroy();
    monthlyChart = null;
    categoryChart = null;
    burndownChart = null;
  }

  function formatLeadTime(hours: number) {
    if (!hours || hours <= 0) {
      return '--';
    }
    const totalMinutes = Math.round(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    if (h && m) {
      return `${h}h ${m}m`;
    }
    if (h) {
      return `${h}h`;
    }
    return `${m}m`;
  }

  const asCurrency = (value: number) => currencyFormatter.format(value);
</script>

<div class="space-y-8">
  <div class="grid gap-4 md:grid-cols-4">
    <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p class="text-xs uppercase tracking-wide text-slate-400">Tasks completed (30 days)</p>
      <p class="mt-2 text-2xl font-semibold text-slate-100">{numberFormatter.format(tasksCompleted30d)}</p>
    </div>
    <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p class="text-xs uppercase tracking-wide text-slate-400">Avg completion time</p>
      <p class="mt-2 text-2xl font-semibold text-slate-100">{averageLeadTimeLabel}</p>
    </div>
    <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p class="text-xs uppercase tracking-wide text-slate-400">Current month expenses</p>
      <p class="mt-2 text-2xl font-semibold text-red-300">{asCurrency(currentMonthExpenses)}</p>
    </div>
    <div class="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <p class="text-xs uppercase tracking-wide text-slate-400">Total balance</p>
      <p class="mt-2 text-2xl font-semibold text-emerald-300">{asCurrency(totalBalance)}</p>
    </div>
  </div>

  {#if loading}
    <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">Loading dashboard...</div>
  {:else if error}
    <div class="rounded-xl border border-red-500/40 bg-red-500/10 p-6 text-sm text-red-200">{error}</div>
  {:else}
    <div class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-200">Monthly income vs expense</h3>
        </div>
        <div class="h-72">
          {#if monthlyChartData.labels.length}
            <canvas bind:this={monthlyCanvas}></canvas>
          {:else}
            <p class="text-sm text-slate-500">Not enough data to render the series yet.</p>
          {/if}
        </div>
      </div>

      <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-200">Expenses by category (current month)</h3>
        </div>
        <div class="h-72">
          {#if categoryChartData.labels.length}
            <canvas bind:this={categoryCanvas}></canvas>
          {:else}
            <p class="text-sm text-slate-500">No expenses recorded for the current month.</p>
          {/if}
        </div>
      </div>

      <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:col-span-2">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-200">Tasks burndown (last 14 days)</h3>
        </div>
        <div class="h-60">
          {#if burndownChartData.labels.length}
            <canvas bind:this={burndownCanvas}></canvas>
          {:else}
            <p class="text-sm text-slate-500">Not enough task completion data to render the burndown.</p>
          {/if}
        </div>
      </div>

      <div class="rounded-xl border border-slate-800 bg-slate-950/60 p-4 lg:col-span-2">
        <h3 class="mb-3 text-sm font-semibold text-slate-200">Account balances</h3>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-slate-800 text-sm">
            <thead class="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="px-3 py-2 text-left">Account</th>
                <th class="px-3 py-2 text-left">Type</th>
                <th class="px-3 py-2 text-left">Balance</th>
                <th class="px-3 py-2 text-left">Income</th>
                <th class="px-3 py-2 text-left">Expense</th>
                <th class="px-3 py-2 text-left">Transfers</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-900/70">
              {#each accountBalances as account (account.accountId)}
                <tr>
                  <td class="px-3 py-2 text-slate-100">{account.name}</td>
                  <td class="px-3 py-2 text-slate-300">{account.type}</td>
                  <td class="px-3 py-2 text-emerald-300">{asCurrency(account.balance)}</td>
                  <td class="px-3 py-2 text-emerald-300">{asCurrency(account.totals.income)}</td>
                  <td class="px-3 py-2 text-red-300">{asCurrency(account.totals.expense)}</td>
                  <td class="px-3 py-2 text-slate-200">{asCurrency(account.totals.transferNet)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if !accountBalances.length}
            <p class="mt-3 text-sm text-slate-500">No accounts available yet.</p>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>
