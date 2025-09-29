<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { browser } from '$app/environment';
  import {
    fetchTasksProductivity,
    fetchFinanceMonthlySeries,
    fetchExpensesByCategory,
    fetchAccountBalances,
  } from '$lib/api/reports';
  import { getCategoryTree, listAccounts } from '$lib/api/finance';
  import type {
    TasksProductivity,
    FinanceMonthlyPoint,
    ExpenseByCategory,
    AccountBalanceSummary,
  } from '$lib/types/reports';
  import type { FinanceCategoryNode, FinanceAccount } from '$lib/types/finance';
  import { getMySettings } from '$lib/api/me';
  import { getCurrencyOptions } from '$lib/utils/currency';

  let loading = true;
  let error: string | null = null;

  let tasksProductivity: TasksProductivity | null = null;
  let monthlySeries: FinanceMonthlyPoint[] = [];
  let expensesByCategory: ExpenseByCategory[] = [];
  let accountBalances: AccountBalanceSummary[] = [];

  let tasksCompleted30d = 0; // legacy var retained for backward logic
  let tasksCompletedWindow = 0;
  let averageLeadTimeLabel = '--';
  let currentMonthExpenses = 0;
  let totalBalance = 0;

  let locale = browser ? navigator.language : 'en-US';
  let currency = 'USD';
  const currencyOptions = getCurrencyOptions();
  let currencyName = 'USD';
  let currencyFormatter = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  });
  let numberFormatter = new Intl.NumberFormat(locale);

  let Chart: typeof import('chart.js/auto').default | null = null;
  let monthlyChart: import('chart.js/auto').Chart | null = null;
  let categoryChart: import('chart.js/auto').Chart | null = null;
  let burndownChart: import('chart.js/auto').Chart | null = null;

  let monthlyCanvas: HTMLCanvasElement | undefined;
  let categoryCanvas: HTMLCanvasElement | undefined;
  let burndownCanvas: HTMLCanvasElement | undefined;

  // Simple theme detection for chart palettes
  const isDark = () => (browser ? document.documentElement.classList.contains('dark') : true);
  const chartPalette = () => {
    if (isDark()) {
      return {
        text: '#cbd5e1', // slate-300
        muted: '#94a3b8', // slate-400
        grid: 'rgba(148, 163, 184, 0.08)',
        border: 'rgba(148, 163, 184, 0.2)',
        legend: '#cbd5e1',
      } as const;
    }
    return {
      text: '#0f172a', // slate-900
      muted: '#475569', // slate-600
      grid: 'rgba(148, 163, 184, 0.15)',
      border: 'rgba(148, 163, 184, 0.35)',
      legend: '#334155', // slate-700
    } as const;
  };

  // Filters
  const nowRef = new Date();
  let filterEndMonth = nowRef.getUTCMonth() + 1; // 1..12
  let filterEndYear = nowRef.getUTCFullYear();
  let filterMonthsBack = 12; // 6 | 12 | 24
  let filterTasksWindowDays = 14; // 7 | 14 | 30

  const monthNames = Array.from({ length: 12 }, (_, i) =>
    new Date(Date.UTC(2000, i, 1)).toLocaleDateString(locale, { month: 'short' }),
  );
  const yearsOptions = Array.from({ length: 6 }, (_, i) => filterEndYear - 3 + i);
  const monthsBackOptions = [6, 12, 24];
  const tasksWindowOptions = [7, 14, 30];
  $: selectedMonthLabel = `${monthNames[(filterEndMonth - 1 + 12) % 12]}/${String(filterEndYear).slice(-2)}`;
  // Category and account filters for dashboard sections
  let categoriesTree: FinanceCategoryNode[] = [];
  let categoryFilterId: number | '' = '';
  let includeSubcategories = true;
  let accountsList: FinanceAccount[] = [];
  let accountFilterId: number | '' = '';

  function flattenCategories(nodes: FinanceCategoryNode[], depth = 0): Array<{ id: number; name: string }> {
    const out: Array<{ id: number; name: string }> = [];
    for (const n of nodes) {
      out.push({ id: n.id, name: `${'\u00A0'.repeat(depth * 2)}${n.name}` });
      if (n.children?.length) out.push(...flattenCategories(n.children, depth + 1));
    }
    return out;
  }

  onMount(async () => {
    const now = new Date();
    try {
      // Load user settings for locale/currency first
      try {
        const my = await getMySettings();
        if (my?.locale) locale = my.locale;
        if (my?.currency) currency = my.currency;
        const opt = currencyOptions.find((c) => c.code === currency);
        currencyName = opt ? `${opt.code} – ${opt.symbol} ${opt.name}` : currency;
        currencyFormatter = new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2 });
        numberFormatter = new Intl.NumberFormat(locale);
      } catch {}
      const module = await import('chart.js/auto');
      Chart = module.default;
      // Preload categories and accounts for filters (non-blocking)
      const [catsRes, accsRes] = await Promise.allSettled([getCategoryTree(), listAccounts()]);
      if (catsRes.status === 'fulfilled') categoriesTree = catsRes.value;
      if (accsRes.status === 'fulfilled') accountsList = accsRes.value;
      await loadDashboard(now);
    } catch (err) {
      console.error('[dashboard] failed to initialise', err);
      error = err instanceof Error ? err.message : 'Failed to load dashboard';
    } finally {
      loading = false;
      // Ensure canvases are bound before attempting to draw charts
      await tick();
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
      from.setDate(from.getDate() - filterTasksWindowDays);

      const productivityPromise = fetchTasksProductivity({
        from: from.toISOString(),
        to: to.toISOString(),
      });

  // Monthly series based on filters
  const endMonthIdx = filterEndMonth - 1; // 0-based
  const endYear = filterEndYear;
  const startDate = new Date(Date.UTC(endYear, endMonthIdx, 1));
  startDate.setUTCMonth(startDate.getUTCMonth() - (filterMonthsBack - 1));

      const monthlySeriesPromise = fetchFinanceMonthlySeries({
        fromMonth: startDate.getUTCMonth() + 1,
        fromYear: startDate.getUTCFullYear(),
        toMonth: endMonthIdx + 1,
        toYear: endYear,
      });

      const expensesPromise = fetchExpensesByCategory({
        month: endMonthIdx + 1,
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

      // If there are no completions in the most recent 14 days window,
      // try a wider time range and anchor the burndown to the last completion date.
      burndownFallbackNote = null;
      burndownAnchor = null;
      if (tasksProductivity) {
        const twoWeeksAgo = new Date(referenceDate);
        twoWeeksAgo.setDate(twoWeeksAgo.getDate() - filterTasksWindowDays);
        const hasRecent = tasksProductivity.daily.some((d) => new Date(`${d.date}T00:00:00Z`) >= twoWeeksAgo);
        if (!hasRecent) {
          // Widen to 120 days in case the demo data exists but is older
          const wideFrom = new Date(referenceDate);
          wideFrom.setDate(wideFrom.getDate() - 120);
          try {
            const widened = await fetchTasksProductivity({
              from: wideFrom.toISOString(),
              to: to.toISOString(),
            });
            if (widened.daily.length) {
              tasksProductivity = widened;
              // Anchor the burndown to the latest completion date
              const last = widened.daily[widened.daily.length - 1];
              const lastDate = new Date(`${last.date}T00:00:00Z`);
              burndownAnchor = lastDate;
              const display = lastDate.toLocaleDateString(locale, { year: '2-digit', month: 'short', day: 'numeric' });
              burndownFallbackNote = `No completions in the last ${filterTasksWindowDays} days — showing ${filterTasksWindowDays} days ending on ${display}.`;
            }
          } catch {
            // ignore fallback errors; we'll keep the original state
          }
        }
      }

      computeKpis(referenceDate);
      // Wait for DOM to reflect new conditional sections (canvas bindings)
      await tick();
      updateCharts();
    } catch (err) {
      console.error('[dashboard] data fetch failed', err);
      error = err instanceof Error ? err.message : 'Failed to load dashboard data';
    }
    finally {
      // Always leave loading state, even if some sections failed
      loading = false;
    }
  }

  function computeKpis(referenceDate: Date) {
    if (tasksProductivity) {
      tasksCompleted30d = tasksProductivity.daily.reduce(
        (total, item) => total + item.completed,
        0,
      );
      tasksCompletedWindow = tasksCompleted30d;

      averageLeadTimeLabel = formatLeadTime(tasksProductivity.averageLeadTimeHours);
    } else {
  tasksCompleted30d = 0;
  tasksCompletedWindow = 0;
      averageLeadTimeLabel = '--';
    }

  currentMonthExpenses = expensesByCategory.reduce((sum, item) => sum + item.amount, 0);
    const balancesForKpi = accountFilterId
      ? accountBalances.filter((a) => a.accountId === Number(accountFilterId))
      : accountBalances;
    totalBalance = balancesForKpi.reduce((sum, item) => sum + (item.balance ?? 0), 0);

    buildChartData(referenceDate);
  }

  let monthlyChartData: { labels: string[]; datasets: { income: number[]; expense: number[]; net: number[] } } = {
    labels: [],
    datasets: { income: [], expense: [], net: [] },
  };

  $: hasMonthlyData =
    monthlyChartData.labels.length > 0 &&
    ((monthlyChartData.datasets.income?.some((v) => v !== 0) ?? false) ||
      (monthlyChartData.datasets.expense?.some((v) => v !== 0) ?? false) ||
      (monthlyChartData.datasets.net?.some((v) => v !== 0) ?? false));

  let categoryChartData: { labels: string[]; values: number[] } = { labels: [], values: [] };
  $: hasCategoryData = categoryChartData.labels.length > 0 && (categoryChartData.values?.some((v) => v !== 0) ?? false);

  let burndownChartData: { labels: string[]; remaining: number[]; ideal: number[] } = {
    labels: [],
    remaining: [],
    ideal: [],
  };
  // Render the burndown chart whenever we have labels; values may be all zeros.
  $: hasBurndownData = burndownChartData.labels.length > 0;

  // Optional anchor date for burndown when we widen the window
  let burndownAnchor: Date | null = null;
  let burndownFallbackNote: string | null = null;

  function buildChartData(referenceDate: Date) {
    monthlyChartData = buildMonthlyChartData();
    categoryChartData = buildCategoryChartData();
    burndownChartData = buildBurndownData(burndownAnchor ?? referenceDate);
    // Chart updates are coordinated by callers after tick()
  }

  function buildMonthlyChartData() {
    if (!monthlySeries.length) {
      return { labels: [], datasets: { income: [], expense: [], net: [] } };
    }
    const labels = monthlySeries.map((point) => point.period);
    const income = monthlySeries.map((point) => point.income);
    const expense = monthlySeries.map((point) => point.expense);
    const net = monthlySeries.map((point) => point.net);
    // Build friendly labels like "Sep/25"
    const friendly = labels.map((period) => {
      const [y, m] = period.split('-').map((v) => Number(v));
      const d = new Date(Date.UTC(y, (m || 1) - 1, 1));
      const mon = d.toLocaleDateString(locale, { month: 'short' });
      const yy = String(d.getUTCFullYear()).slice(-2);
      return `${mon}/${yy}`;
    });
    return { labels: friendly, datasets: { income, expense, net } };
  }

  function buildCategoryChartData() {
    if (!expensesByCategory.length) {
      return { labels: [], values: [] };
    }
    let rows = expensesByCategory;
    if (categoryFilterId) {
      const targetId = Number(categoryFilterId);
      const allowed = new Set<number>();
      const addDesc = (nodes: FinanceCategoryNode[]): boolean => {
        for (const n of nodes) {
          if (n.id === targetId) {
            const stack: FinanceCategoryNode[] = [n];
            while (stack.length) {
              const cur = stack.pop()!;
              allowed.add(cur.id);
              if (includeSubcategories && cur.children?.length) stack.push(...cur.children);
            }
            return true;
          }
          if (n.children?.length && addDesc(n.children)) return true;
        }
        return false;
      };
      addDesc(categoriesTree);
      rows = rows.filter((r) => (r.categoryId != null ? allowed.has(r.categoryId) : false));
    }
    const labels = rows.map((item) => item.categoryName);
    const values = rows.map((item) => item.amount);
    return { labels, values };
  }

  function handleCategoryFilterChange() {
    categoryChartData = buildCategoryChartData();
    tick().then(() => updateCategoryChart());
  }

  function buildBurndownData(referenceDate: Date) {
    // Always build a 14-day window, even if we don't have data yet.
    // This shows a flat zero line instead of an empty placeholder.
    const tempDate = new Date(referenceDate);
    tempDate.setHours(0, 0, 0, 0);

    const labels: string[] = [];
    const dailyValues: number[] = [];

    const dailyMap = new Map<string, number>();
    if (tasksProductivity) {
      for (const entry of tasksProductivity.daily) {
        dailyMap.set(entry.date, entry.completed);
      }
    }

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
    if (!hasMonthlyData) {
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
            borderColor: 'rgba(34, 197, 94, 0.9)',
            backgroundColor: 'rgba(34, 197, 94, 0.15)',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 2,
            pointHoverRadius: 4,
            fill: false,
          },
          {
            label: 'Expense',
            data: monthlyChartData.datasets.expense,
            borderColor: 'rgba(239, 68, 68, 0.9)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 2,
            pointHoverRadius: 4,
            fill: false,
          },
          {
            label: 'Net (income - expense)',
            data: monthlyChartData.datasets.net,
            borderColor: 'rgba(59, 130, 246, 0.9)',
            backgroundColor: 'rgba(59, 130, 246, 0.15)',
            borderWidth: 2,
            borderDash: [6, 4],
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: 4 },
        animation: { duration: 500, easing: 'easeOutQuart' },
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: true,
            position: 'bottom',
            labels: { color: chartPalette().legend, usePointStyle: true, boxWidth: 8, boxHeight: 8 },
          },
          tooltip: {
            mode: 'index',
            intersect: false,
            callbacks: {
              label: (ctx) => {
                const label = ctx.dataset?.label ?? '';
                const v = Number(ctx.parsed?.y ?? 0);
                return `${label}: ${currencyFormatter.format(v)}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: chartPalette().muted, maxRotation: 0 },
            grid: { color: chartPalette().grid },
            border: { color: chartPalette().border },
          },
          y: {
            ticks: {
              color: chartPalette().muted,
              callback: (value) => currencyFormatter.format(Number(value)),
            },
            grid: { color: chartPalette().grid },
            border: { color: chartPalette().border },
          },
        },
        elements: { point: { hitRadius: 6 } },
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
    if (!hasCategoryData) {
      return;
    }
    categoryChart = new Chart(categoryCanvas, {
      type: 'doughnut',
      data: {
        labels: categoryChartData.labels,
        datasets: [
          {
            data: categoryChartData.values,
            backgroundColor: categoryChartData.labels.map((_, index) =>
              `hsl(${(index * 47) % 360} 70% 55%)`,
            ),
            borderColor: 'rgba(15, 23, 42, 0.6)',
            borderWidth: 1.5,
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { color: chartPalette().legend, usePointStyle: true, boxWidth: 10, boxHeight: 10 } },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const v = Number(ctx.parsed ?? 0);
                const ds = ctx.dataset?.data as number[] | undefined;
                const total = (ds ?? []).reduce((s, n) => s + Number(n || 0), 0);
                const pct = total ? ((v / total) * 100).toFixed(1) : '0.0';
                return `${ctx.label}: ${currencyFormatter.format(v)} (${pct}%)`;
              },
            },
          },
        },
        animation: { duration: 500, easing: 'easeOutQuart' },
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
    if (!hasBurndownData) {
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
            borderColor: 'rgba(239, 68, 68, 0.9)',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            borderWidth: 2,
            tension: 0.25,
            pointRadius: 0,
            fill: true,
          },
          {
            label: 'Ideal',
            data: burndownChartData.ideal,
            borderColor: 'rgba(148, 163, 184, 0.6)',
            borderDash: [6, 4],
            borderWidth: 2,
            tension: 0,
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        animation: { duration: 500, easing: 'easeOutQuart' },
        plugins: {
          legend: { display: true, position: 'bottom', labels: { color: chartPalette().legend, usePointStyle: true, boxWidth: 8, boxHeight: 8 } },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset?.label ?? ''}: ${numberFormatter.format(Number(ctx.parsed?.y ?? 0))}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: chartPalette().muted, maxRotation: 0 },
            grid: { color: chartPalette().grid },
            border: { color: chartPalette().border },
          },
          y: {
            ticks: {
              color: chartPalette().muted,
              callback: (value) => numberFormatter.format(Number(value)),
            },
            grid: { color: chartPalette().grid },
            border: { color: chartPalette().border },
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

  async function refreshDashboard() {
    const now = new Date();
    await loadDashboard(now);
    // loadDashboard already awaits tick and triggers updateCharts, but
    // keep an extra tick here to be safe when refresh is spammed.
    await tick();
    updateCharts();
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

  $: if (categoryFilterId !== undefined) {
    // Recompute chart data when filters change
    categoryChartData = buildCategoryChartData();
  }

  // Keep Expenses KPI in sync with category filter (sum of visible slices)
  $: currentMonthExpenses = (categoryChartData.values ?? []).reduce((sum, v) => sum + v, 0);

  $: if (accountFilterId !== undefined) {
    // Recompute KPIs when account filter changes
    const balancesForKpi = accountFilterId
      ? accountBalances.filter((a) => a.accountId === Number(accountFilterId))
      : accountBalances;
    totalBalance = balancesForKpi.reduce((sum, item) => sum + (item.balance ?? 0), 0);
  }
</script>

<div class="space-y-8">
  <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <p class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Tasks completed (last {filterTasksWindowDays} days)</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{numberFormatter.format(tasksCompletedWindow)}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <p class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Avg completion time</p>
      <p class="mt-2 text-2xl font-semibold text-slate-900 dark:text-slate-100">{averageLeadTimeLabel}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <p class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Expenses — {selectedMonthLabel} <span title={currencyName} class="text-[10px] text-slate-500 align-middle">({currency})</span></p>
      <p class="mt-2 text-2xl font-semibold text-rose-600 dark:text-red-300">{asCurrency(currentMonthExpenses)}</p>
    </div>
    <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
      <div class="flex items-start justify-between">
        <div>
          <p class="text-xs uppercase tracking-wide text-slate-600 dark:text-slate-400">Total balance <span title={currencyName} class="text-[10px] text-slate-500 align-middle">({currency})</span></p>
          <p class="mt-2 text-2xl font-semibold text-emerald-600 dark:text-emerald-300">{asCurrency(totalBalance)}</p>
        </div>
        <button
          type="button"
          class="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
          on:click={refreshDashboard}
          aria-label="Refresh dashboard"
        >
          Refresh
        </button>
      </div>
    </div>
  </div>

  <!-- Filters -->
  <div class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
    <div class="grid gap-3 md:grid-cols-3 lg:grid-cols-5">
      <div class="flex items-center gap-2">
        <label for="filter-month" class="w-20 text-xs text-slate-600 dark:text-slate-400">Month</label>
        <select id="filter-month" bind:value={filterEndMonth} class="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
          {#each monthNames as label, i}
            <option value={i + 1}>{label}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <label for="filter-year" class="w-20 text-xs text-slate-600 dark:text-slate-400">Year</label>
        <select id="filter-year" bind:value={filterEndYear} class="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
          {#each yearsOptions as y}
            <option value={y}>{y}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2">
        <label for="filter-monthsback" class="w-24 text-xs text-slate-600 dark:text-slate-400">Months back</label>
        <select id="filter-monthsback" bind:value={filterMonthsBack} class="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
          {#each monthsBackOptions as opt}
            <option value={opt}>{opt}</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center gap-2 md:col-span-2 lg:col-span-1">
        <label for="filter-taskwindow" class="w-28 text-xs text-slate-600 dark:text-slate-400">Tasks window</label>
        <select id="filter-taskwindow" bind:value={filterTasksWindowDays} class="w-full rounded-md border border-slate-300 bg-white p-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
          {#each tasksWindowOptions as opt}
            <option value={opt}>{opt} days</option>
          {/each}
        </select>
      </div>
      <div class="flex items-center justify-end">
        <button type="button" class="rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:border-indigo-700 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" on:click={refreshDashboard}>Apply</button>
      </div>
    </div>
  </div>

  {#if loading}
    <!-- Skeletons -->
    <div class="grid gap-4 md:grid-cols-4">
      {#each Array(4) as _}
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
          <div class="h-3 w-32 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
          <div class="mt-4 h-7 w-24 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
        </div>
      {/each}
    </div>
  <div class="mt-6 grid gap-6 md:grid-cols-2">
      {#each Array(3) as _, i}
  <div class={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 ${i === 2 ? 'md:col-span-2' : ''}`}>
          <div class="mb-4 h-4 w-48 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
          <div class="h-72 animate-pulse rounded bg-slate-100 dark:bg-slate-900"></div>
        </div>
      {/each}
  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 md:col-span-2">
        <div class="mb-3 h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800"></div>
        <div class="h-40 animate-pulse rounded bg-slate-100 dark:bg-slate-900"></div>
      </div>
    </div>
  {:else if error}
    <div class="rounded-xl border border-red-300 bg-red-50 p-6 text-sm text-rose-700 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200">{error}</div>
  {:else}
  <div class="grid gap-6 md:grid-cols-2">
      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-200">Monthly income vs expense</h3>
        </div>
        <div class="h-72">
          {#if hasMonthlyData}
            <canvas bind:this={monthlyCanvas}></canvas>
          {:else}
            <div class="flex h-full items-center justify-center text-sm text-slate-500">
              Not enough data to render the series yet.
            </div>
          {/if}
        </div>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
        <div class="mb-4 flex items-center justify-between gap-3">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-200">Expenses by category ({selectedMonthLabel})</h3>
          <div class="flex items-center gap-2 text-xs">
            <label for="filter-category" class="text-slate-600 dark:text-slate-400">Category</label>
            <select id="filter-category" bind:value={categoryFilterId} class="rounded-md border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200" on:change={handleCategoryFilterChange}>
              <option value="">All</option>
              {#each flattenCategories(categoriesTree) as c}
                <option value={c.id}>{c.name}</option>
              {/each}
            </select>
            <label class="ml-2 inline-flex items-center gap-1 text-slate-600 dark:text-slate-400">
              <input type="checkbox" bind:checked={includeSubcategories} on:change={handleCategoryFilterChange} class="cb" />
              <span>Include sub</span>
            </label>
          </div>
        </div>
        <div class="h-72">
          {#if hasCategoryData}
            <canvas bind:this={categoryCanvas}></canvas>
          {:else}
            <div class="flex h-full items-center justify-center text-sm text-slate-500">
              No expenses recorded for the current month.
            </div>
          {/if}
        </div>
      </div>

  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 md:col-span-2">
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-200">Tasks burndown (last {filterTasksWindowDays} days)</h3>
          {#if burndownFallbackNote}
            <p class="text-xs text-slate-600 dark:text-slate-400">{burndownFallbackNote}</p>
          {/if}
        </div>
        <div class="h-60">
          {#if hasBurndownData}
            <canvas bind:this={burndownCanvas}></canvas>
          {:else}
            <div class="flex h-full items-center justify-center text-sm text-slate-500">
              Not enough task completion data to render the burndown.
            </div>
          {/if}
        </div>
      </div>

  <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 md:col-span-2">
        <div class="mb-3 flex items-center justify-between">
          <h3 class="text-sm font-semibold text-slate-900 dark:text-slate-200">Account balances</h3>
          <div class="flex items-center gap-2 text-xs">
            <label for="filter-account" class="text-slate-600 dark:text-slate-400">Account</label>
            <select id="filter-account" bind:value={accountFilterId} class="rounded-md border border-slate-300 bg-white p-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-200">
              <option value="">All</option>
              {#each accountsList as acc}
                <option value={acc.id}>{acc.name}</option>
              {/each}
            </select>
          </div>
        </div>
        <!-- Desktop/Table -->
        <div class="hidden overflow-x-auto sm:block">
          <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-950/80 dark:text-slate-400">
              <tr>
                <th class="px-3 py-2 text-left">Account</th>
                <th class="px-3 py-2 text-left">Type</th>
                <th class="px-3 py-2 text-left">Balance</th>
                <th class="px-3 py-2 text-left">Income</th>
                <th class="px-3 py-2 text-left">Expense</th>
                <th class="px-3 py-2 text-left">Transfers</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 dark:divide-slate-900/70">
              {#each (accountFilterId ? accountBalances.filter(a => a.accountId === Number(accountFilterId)) : accountBalances) as account (account.accountId)}
                <tr>
                  <td class="px-3 py-2 text-slate-900 dark:text-slate-100">{account.name}</td>
                  <td class="px-3 py-2 text-slate-700 dark:text-slate-300">{account.type}</td>
                  <td class="px-3 py-2 text-emerald-600 dark:text-emerald-300">{asCurrency(account.balance)}</td>
                  <td class="px-3 py-2 text-emerald-600 dark:text-emerald-300">{asCurrency(account.totals.income)}</td>
                  <td class="px-3 py-2 text-rose-600 dark:text-red-300">{asCurrency(account.totals.expense)}</td>
                  <td class="px-3 py-2 text-slate-800 dark:text-slate-200">{asCurrency(account.totals.transferNet)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
          {#if !(accountFilterId ? accountBalances.some(a => a.accountId === Number(accountFilterId)) : accountBalances.length)}
            <p class="mt-3 text-sm text-slate-500">No accounts available yet.</p>
          {/if}
        </div>
        <!-- Mobile Cards -->
        <div class="sm:hidden">
          {#if (accountFilterId ? accountBalances.some(a => a.accountId === Number(accountFilterId)) : accountBalances.length)}
            <ul class="space-y-3">
              {#each (accountFilterId ? accountBalances.filter(a => a.accountId === Number(accountFilterId)) : accountBalances) as account (account.accountId)}
                <li class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/70">
                  <div class="flex items-center justify-between">
                    <div>
                      <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{account.name}</p>
                      <p class="text-xs text-slate-600 dark:text-slate-400">{account.type}</p>
                    </div>
                    <p class="text-sm font-semibold text-emerald-600 dark:text-emerald-300">{asCurrency(account.balance)}</p>
                  </div>
                  <div class="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                    <div class="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/60">
                      <p class="text-slate-600 dark:text-slate-400">Income</p>
                      <p class="text-emerald-600 dark:text-emerald-300">{asCurrency(account.totals.income)}</p>
                    </div>
                    <div class="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/60">
                      <p class="text-slate-600 dark:text-slate-400">Expense</p>
                      <p class="text-rose-600 dark:text-red-300">{asCurrency(account.totals.expense)}</p>
                    </div>
                    <div class="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/60">
                      <p class="text-slate-600 dark:text-slate-400">Transfers</p>
                      <p class="text-slate-800 dark:text-slate-200">{asCurrency(account.totals.transferNet)}</p>
                    </div>
                  </div>
                </li>
              {/each}
            </ul>
          {:else}
            <p class="text-sm text-slate-500">No accounts available yet.</p>
          {/if}
        </div>
      </div>

      <!-- Quick actions -->
      <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/60 lg:col-span-2">
        <h3 class="mb-3 text-sm font-semibold text-slate-900 dark:text-slate-200">Quick actions</h3>
        <div class="grid gap-3 sm:grid-cols-3">
          <a href="/app/finance/transactions" class="rounded-md border border-slate-300 bg-white px-4 py-3 text-center text-sm text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white">New transaction</a>
          <a href="/app/finance/accounts" class="rounded-md border border-slate-300 bg-white px-4 py-3 text-center text-sm text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white">New account</a>
          <a href="/app/tasks" class="rounded-md border border-slate-300 bg-white px-4 py-3 text-center text-sm text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white">New task</a>
        </div>
      </div>
    </div>
  {/if}
</div>
