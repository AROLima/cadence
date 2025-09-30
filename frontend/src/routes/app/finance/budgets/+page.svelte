<script lang="ts">
	import { onMount } from 'svelte';
		import { toasts } from '$lib/ui/toast';
		import { getMySettings } from '$lib/api/me';
		import { apiFetch } from '$lib/utils/api';
		import { getCategoryTree } from '$lib/api/finance';
		import { fetchExpensesByCategory } from '$lib/api/reports';
		import { onDestroy } from 'svelte';

	type Budget = {
		id: number;
		categoryId: number;
		categoryName: string;
		month: number;
		year: number;
		plannedAmount: number;
		actualAmount: number;
	};

	type CreateBudget = {
		categoryId: number;
		month: number;
		year: number;
		plannedAmount: number;
	};

	interface ApiResponse<T> { success: boolean; data: T; message?: string | string[] }

		let loading = false;
	let error: string | null = null;
	let budgets: Budget[] = [];

		// categories for select
		type CategoryNode = { id: number; name: string; parentId: number | null; children: CategoryNode[] };
		let categories: CategoryNode[] = [];
		const flattenCategories = (nodes: CategoryNode[], depth = 0): { id: number; name: string }[] =>
			nodes.flatMap((node) => {
				const prefix = depth ? `${'\u00A0'.repeat(depth * 2)}- ` : '';
				const current = [{ id: node.id, name: `${prefix}${node.name}` }];
				const children = node.children ? flattenCategories(node.children, depth + 1) : [];
				return [...current, ...children];
			});
		$: categoryOptions = flattenCategories(categories ?? []);

		// Combobox state for category selection
		let newCategoryQuery = '';
		let showCategoryDropdown = false;
		const MAX_SUGGESTIONS = 12;
		$: filteredCategoryOptions = (newCategoryQuery?.trim()?.length
			? categoryOptions.filter((c) => c.name.toLowerCase().includes(newCategoryQuery.trim().toLowerCase()))
			: categoryOptions).slice(0, MAX_SUGGESTIONS);

		// Recently used categories (persisted)
		const RECENT_KEY = 'recentBudgetCategoryIds';
		let recentCategoryIds: number[] = [];
		function loadRecents() {
			try {
				const raw = localStorage.getItem(RECENT_KEY);
				recentCategoryIds = raw ? (JSON.parse(raw) as number[]) : [];
			} catch {
				recentCategoryIds = [];
			}
		}
		function bumpRecent(id: number) {
			const set = new Set([id, ...recentCategoryIds]);
			recentCategoryIds = Array.from(set).slice(0, 8);
			try {
				localStorage.setItem(RECENT_KEY, JSON.stringify(recentCategoryIds));
			} catch {}
		}

		// Combobox visibility helpers
		$: hasRecents = recentCategoryIds.some((rid) => !!getCategoryById(rid));
		$: hasOptions = filteredCategoryOptions.length > 0;

		// Recommendation data (by category)
		type Reco = { lastMonthActual: number; avg3m: number };
		let recommendations = new Map<number, Reco>();

		function monthBack(year: number, month: number, diff: number): { year: number; month: number } {
			const d = new Date(Date.UTC(year, month - 1, 1));
			d.setUTCMonth(d.getUTCMonth() - diff);
			return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
		}

	let locale = 'en-US';
	let currency = 'USD';
	let currencyFormatter = new Intl.NumberFormat(locale, { style: 'currency', currency });

	const now = new Date();
	let filterYear: number | string = now.getUTCFullYear();
	let filterMonth: number | string = now.getUTCMonth() + 1; // 1-12

	function prevMonth(y: number, m: number): { year: number; month: number } {
		const d = new Date(Date.UTC(y, m - 2, 1));
		return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
	}

	function nextMonth(y: number, m: number): { year: number; month: number } {
		const d = new Date(Date.UTC(y, m, 1));
		return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
	}

	// create form (simple)
		let newCategoryId: number | '' = '';
	let newPlanned = 0;

		// inline edit state
		let editingId: number | null = null;
		let plannedEdit = 0;
		let savingId: number | null = null;

		const adjustStep = 50; // quick adjust step

		// Debounce per-row save to avoid many PATCH in quick succession
		const saveTimers = new Map<number, ReturnType<typeof setTimeout>>();

		// Mobile actions dropdown state
		let showActionsMenu = false;

	function fmt(value: number) {
		try {
			return currencyFormatter.format(value);
		} catch {
			return value.toFixed(2);
		}
	}

	function getCategoryById(id: number) {
		return categoryOptions.find((c) => c.id === id);
	}

	function msg(payload: unknown, fallback: string) {
		const m = (payload as any)?.message;
		if (!m) return fallback;
		if (Array.isArray(m)) return String(m[0] ?? fallback);
		return String(m);
	}

	function clampInt(value: unknown, min: number, max: number, fallback: number): number {
		const n = Number(value);
		if (!Number.isFinite(n)) return fallback;
		return Math.min(max, Math.max(min, Math.trunc(n)));
	}

		let loadBudgetsTimeout: ReturnType<typeof setTimeout> | null = null;
		let inFlight = false;
		async function loadBudgetsNow() {
		loading = true;
		error = null;
		try {
			// Load user settings for locale/currency
			try {
				const my = await getMySettings();
				if (my?.locale) locale = my.locale;
				if (my?.currency) currency = my.currency;
				currencyFormatter = new Intl.NumberFormat(locale, { style: 'currency', currency });
			} catch {}

				// Load categories for select
				try {
					categories = await getCategoryTree();
				} catch (e) {
					console.warn('[budgets] categories load failed', e);
				}

			const safeYear = clampInt(filterYear, 2000, 3000, now.getUTCFullYear());
			const safeMonth = clampInt(filterMonth, 1, 12, now.getUTCMonth() + 1);
			// normalize UI too
			filterYear = safeYear;
			filterMonth = safeMonth;

			const params = new URLSearchParams();
			params.set('year', String(safeYear));
			params.set('month', String(safeMonth));

			const url = `/finance/budgets${params.toString() ? `?${params.toString()}` : ''}`;
			console.debug('[budgets] GET', url);
			const res = await apiFetch(url);
			const payload = (await res.json()) as ApiResponse<Budget[]>;
			if (!res.ok || !payload?.success) {
				throw new Error(msg(payload, 'Failed to load budgets'));
			}
			budgets = payload.data ?? [];
					updateCharts();
		} catch (e) {
			console.error('[budgets] load failed', e);
			error = e instanceof Error ? e.message : 'Failed to load budgets';
			toasts.push({ title: 'Budgets', description: error, variant: 'error' });
		} finally {
			loading = false;
			inFlight = false;
		}
	}

	function loadBudgetsDebounced(delay = 150) {
		if (loadBudgetsTimeout) clearTimeout(loadBudgetsTimeout);
		loadBudgetsTimeout = setTimeout(() => {
			if (inFlight) return; // drop if a request is already in-flight
			inFlight = true;
			void loadBudgetsNow();
		}, delay);
	}

	async function createBudget() {
		if (!newCategoryId || !newPlanned || newPlanned <= 0) {
			toasts.push({ title: 'Create budget', description: 'Select a category and provide a positive amount.', variant: 'error' });
			return;
		}
		try {
			const res = await apiFetch('/finance/budgets', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					categoryId: Number(newCategoryId),
					month: clampInt(filterMonth, 1, 12, now.getUTCMonth() + 1),
					year: clampInt(filterYear, 2000, 3000, now.getUTCFullYear()),
					plannedAmount: Number(newPlanned),
				} satisfies CreateBudget),
			});
			const payload = (await res.json()) as ApiResponse<Budget>;
			if (!res.ok || !payload?.success) {
				throw new Error(msg(payload, 'Failed to create budget'));
			}
			toasts.push({ title: 'Budget created', variant: 'success' });
			newCategoryId = '';
			newPlanned = 0;
			await loadBudgetsNow();
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to create budget';
			toasts.push({ title: 'Create failed', description: message, variant: 'error' });
		}
	}

	async function deleteBudget(id: number) {
		try {
			const res = await apiFetch(`/finance/budgets/${id}`, { method: 'DELETE' });
			const payload = (await res.json()) as ApiResponse<{ message?: string }>;
			if (!res.ok || !payload?.success) {
				throw new Error(msg(payload, 'Failed to delete budget'));
			}
			toasts.push({ title: 'Budget deleted', variant: 'success' });
			await loadBudgetsNow();
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to delete budget';
			toasts.push({ title: 'Delete failed', description: message, variant: 'error' });
		}
	}

	function applyFilter(change: 'month' | 'year', value: number) {
		if (change === 'month') filterMonth = clampInt(value, 1, 12, now.getUTCMonth() + 1);
		if (change === 'year') filterYear = clampInt(value, 2000, 3000, now.getUTCFullYear());
		loadBudgetsDebounced();
	}

	async function adjustPlanned(b: Budget, delta: number) {
		plannedEdit = Math.max(0, (editingId === b.id ? plannedEdit : b.plannedAmount) + delta);
		editingId = b.id;
		const existing = saveTimers.get(b.id);
		if (existing) clearTimeout(existing);
		const t = setTimeout(() => {
			void saveEdit(b);
			saveTimers.delete(b.id);
		}, 350);
		saveTimers.set(b.id, t);
	}

	async function copyFromPreviousMonth() {
		const safeYear = clampInt(filterYear, 2000, 3000, now.getUTCFullYear());
		const safeMonth = clampInt(filterMonth, 1, 12, now.getUTCMonth() + 1);
		const { year: py, month: pm } = prevMonth(safeYear, safeMonth);
		try {
			const params = new URLSearchParams({ year: String(py), month: String(pm) });
			const res = await apiFetch(`/finance/budgets?${params.toString()}`);
			const payload = (await res.json()) as ApiResponse<Budget[]>;
			if (!res.ok || !payload?.success) throw new Error(msg(payload, 'Failed to load previous budgets'));
			const prev = payload.data ?? [];
			const existing = new Set(budgets.map((b) => b.categoryId));
			let created = 0;
			for (const pb of prev) {
				if (existing.has(pb.categoryId)) continue;
				const cr = await apiFetch('/finance/budgets', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ categoryId: pb.categoryId, month: safeMonth, year: safeYear, plannedAmount: pb.plannedAmount }),
				});
				const cp = (await cr.json()) as ApiResponse<Budget>;
				if (cr.ok && cp?.success) {
					created += 1;
				}
			}
			toasts.push({ title: 'Budgets copied', description: created ? `${created} new budgets created` : 'Nothing to copy', variant: created ? 'success' : 'default' });
			await loadBudgetsNow();
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to copy budgets';
			toasts.push({ title: 'Copy failed', description: message, variant: 'error' });
		}
	}

	async function copyFromPreviousMonthOverwrite() {
		const confirmed = window.confirm('Copy last month budgets and overwrite current planned amounts?');
		if (!confirmed) return;
		const safeYear = clampInt(filterYear, 2000, 3000, now.getUTCFullYear());
		const safeMonth = clampInt(filterMonth, 1, 12, now.getUTCMonth() + 1);
		const { year: py, month: pm } = prevMonth(safeYear, safeMonth);
		try {
			const params = new URLSearchParams({ year: String(py), month: String(pm) });
			const res = await apiFetch(`/finance/budgets?${params.toString()}`);
			const payload = (await res.json()) as ApiResponse<Budget[]>;
			if (!res.ok || !payload?.success) throw new Error(msg(payload, 'Failed to load previous budgets'));
			const prev = payload.data ?? [];
			const index = new Map(budgets.map((b) => [b.categoryId, b] as const));
			let updated = 0;
			for (const pb of prev) {
				const current = index.get(pb.categoryId);
				if (current) {
					await apiFetch(`/finance/budgets/${current.id}`, {
						method: 'PATCH', headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ plannedAmount: pb.plannedAmount }),
					});
					updated += 1;
				} else {
					await apiFetch('/finance/budgets', {
						method: 'POST', headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ categoryId: pb.categoryId, month: safeMonth, year: safeYear, plannedAmount: pb.plannedAmount }),
					});
					updated += 1;
				}
			}
			toasts.push({ title: 'Budgets overwritten', description: `${updated} budgets updated/created`, variant: 'success' });
			await loadBudgetsNow();
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to overwrite budgets';
			toasts.push({ title: 'Overwrite failed', description: message, variant: 'error' });
		}
	}

	async function setPlannedToLastMonthActual() {
		const confirmed = window.confirm("Set planned = last month actual for all categories? This overwrites current planned amounts.");
		if (!confirmed) return;
		const safeYear = clampInt(filterYear, 2000, 3000, now.getUTCFullYear());
		const safeMonth = clampInt(filterMonth, 1, 12, now.getUTCMonth() + 1);
		const { year: py, month: pm } = prevMonth(safeYear, safeMonth);
		try {
			const params = new URLSearchParams({ year: String(py), month: String(pm) });
			const res = await apiFetch(`/finance/budgets?${params.toString()}`);
			const payload = (await res.json()) as ApiResponse<Budget[]>;
			if (!res.ok || !payload?.success) throw new Error(msg(payload, 'Failed to load last month budgets'));
			const prev = payload.data ?? [];
			const index = new Map(budgets.map((b) => [b.categoryId, b] as const));
			let updated = 0;
			for (const pb of prev) {
				const amount = pb.actualAmount ?? 0;
				const current = index.get(pb.categoryId);
				if (current) {
					await apiFetch(`/finance/budgets/${current.id}`, {
						method: 'PATCH', headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ plannedAmount: amount }),
					});
					updated += 1;
				} else {
					await apiFetch('/finance/budgets', {
						method: 'POST', headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ categoryId: pb.categoryId, month: safeMonth, year: safeYear, plannedAmount: amount }),
					});
					updated += 1;
				}
			}
			toasts.push({ title: 'Planned set to last month actual', description: `${updated} budgets updated/created`, variant: 'success' });
			await loadBudgetsNow();
		} catch (e) {
			const message = e instanceof Error ? e.message : 'Failed to set planned values';
			toasts.push({ title: 'Bulk update failed', description: message, variant: 'error' });
		}
	}

	async function loadRecommendations() {
		try {
			const y = clampInt(filterYear, 2000, 3000, now.getUTCFullYear());
			const m = clampInt(filterMonth, 1, 12, now.getUTCMonth() + 1);
			const prev1 = monthBack(y, m, 1);
			const prev2 = monthBack(y, m, 2);
			const prev3 = monthBack(y, m, 3);

			const [r1, r2, r3] = await Promise.all([
				fetchExpensesByCategory({ year: prev1.year, month: prev1.month }),
				fetchExpensesByCategory({ year: prev2.year, month: prev2.month }),
				fetchExpensesByCategory({ year: prev3.year, month: prev3.month }),
			]);
			const amounts = new Map<number, { s: number; c: number; last?: number }>();
			for (const row of r1) {
				if (row.categoryId == null) continue;
				const prev = amounts.get(row.categoryId) ?? { s: 0, c: 0 };
				amounts.set(row.categoryId, { s: prev.s + row.amount, c: prev.c + 1, last: row.amount });
			}
			for (const row of r2) {
				if (row.categoryId == null) continue;
				const prev = amounts.get(row.categoryId) ?? { s: 0, c: 0 };
				amounts.set(row.categoryId, { s: prev.s + row.amount, c: prev.c + 1, last: prev.last });
			}
			for (const row of r3) {
				if (row.categoryId == null) continue;
				const prev = amounts.get(row.categoryId) ?? { s: 0, c: 0 };
				amounts.set(row.categoryId, { s: prev.s + row.amount, c: prev.c + 1, last: prev.last });
			}
			const rec = new Map<number, Reco>();
			for (const [cid, v] of amounts) {
				const avg = v.s / 3; // treat missing months as 0 to smooth spikes
				rec.set(cid, { lastMonthActual: v.last ?? 0, avg3m: avg });
			}
			recommendations = rec;
		} catch (e) {
			console.warn('[budgets] recommendations load failed', e);
		}
	}

	async function applyAvg3m(b: Budget) {
		const r = recommendations.get(b.categoryId);
		if (!r) return;
		plannedEdit = Math.max(0, r.avg3m);
		editingId = b.id;
		await saveEdit(b);
	}

	onMount(() => {
		loadRecents();
		loadBudgetsDebounced();
	});

			function startEdit(b: Budget) {
				editingId = b.id;
				plannedEdit = b.plannedAmount;
			}

			function cancelEdit() {
				editingId = null;
				plannedEdit = 0;
			}

			async function saveEdit(b: Budget) {
				if (plannedEdit <= 0) {
					toasts.push({ title: 'Update budget', description: 'Provide a positive planned amount.', variant: 'error' });
					return;
				}
				savingId = b.id;
				try {
					const res = await apiFetch(`/finance/budgets/${b.id}`, {
						method: 'PATCH',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ plannedAmount: Number(plannedEdit) }),
					});
					const payload = (await res.json()) as ApiResponse<Budget>;
					if (!res.ok || !payload?.success) {
						throw new Error(msg(payload, 'Failed to update budget'));
					}
					toasts.push({ title: 'Budget updated', variant: 'success' });
					editingId = null;
					plannedEdit = 0;
					await loadBudgetsNow();
				} catch (e) {
					const message = e instanceof Error ? e.message : 'Failed to update budget';
					toasts.push({ title: 'Update failed', description: message, variant: 'error' });
				} finally {
					savingId = null;
				}
			}

			// Summary
			$: totalPlanned = budgets.reduce((sum, b) => sum + (b.plannedAmount ?? 0), 0);
			$: totalActual = budgets.reduce((sum, b) => sum + (b.actualAmount ?? 0), 0);
			$: progressPct = totalPlanned > 0 ? Math.min(100, Math.round((totalActual / totalPlanned) * 100)) : 0;

			// Charts (lazy load Chart.js in browser)
			let barCanvas: HTMLCanvasElement | null = null;
			let pieCanvas: HTMLCanvasElement | null = null;
			let barChart: any = null;
			let pieChart: any = null;

			async function updateCharts() {
				if (typeof window === 'undefined') return;
				if (!barCanvas || !pieCanvas) return;
				const { default: Chart } = await import('chart.js/auto');

				const labels = budgets.map((b) => b.categoryName);
				const planned = budgets.map((b) => b.plannedAmount);
				const actual = budgets.map((b) => b.actualAmount);

				const barData = {
					labels,
					datasets: [
						{ label: 'Planned', data: planned, backgroundColor: 'rgba(99, 102, 241, 0.6)' },
						{ label: 'Actual', data: actual, backgroundColor: 'rgba(16, 185, 129, 0.6)' },
					],
				};

				const pieData = {
					labels,
					datasets: [
						{
							data: actual,
							backgroundColor: labels.map((_, idx) => `hsl(${(idx * 47) % 360} 70% 55%)`),
						},
					],
				};

				if (barChart) {
					barChart.data = barData;
					barChart.update();
				} else if (barCanvas) {
					barChart = new Chart(barCanvas.getContext('2d')!, {
						type: 'bar',
						data: barData,
						options: { responsive: true, maintainAspectRatio: false }
					});
				}

				if (pieChart) {
					pieChart.data = pieData;
					pieChart.update();
				} else if (pieCanvas) {
					pieChart = new Chart(pieCanvas.getContext('2d')!, {
						type: 'pie',
						data: pieData,
						options: { responsive: true, maintainAspectRatio: false }
					});
				}
			}

			onDestroy(() => {
				try { barChart?.destroy(); } catch {}
				try { pieChart?.destroy(); } catch {}
			});
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
		<div>
			<h2 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Budgets</h2>
			<p class="text-sm text-slate-600 dark:text-slate-400">Plan monthly budgets and track progress.</p>
		</div>
		<div class="flex items-center gap-2 flex-wrap sm:flex-nowrap gap-y-2">
			<button
				type="button"
				class="rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
				on:click={() => { const y = clampInt(filterYear, 2000, 3000, now.getUTCFullYear()); const m = clampInt(filterMonth, 1, 12, now.getUTCMonth()+1); const p = prevMonth(y, m); filterYear = p.year; filterMonth = p.month; loadBudgetsDebounced(); }}
			>
				‹ Prev
			</button>
			<select
				class="rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
				bind:value={filterMonth}
				on:change={() => { filterMonth = clampInt(filterMonth, 1, 12, now.getUTCMonth() + 1); loadBudgetsDebounced(); }}
			>
				{#each Array.from({ length: 12 }, (_, i) => i + 1) as m}
					<option value={m}>{m.toString().padStart(2, '0')}</option>
				{/each}
			</select>
			<input
				class="w-28 rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
				type="number"
				min="2000"
				max="3000"
				bind:value={filterYear}
				on:input={(e) => { filterYear = clampInt((e.target as HTMLInputElement).value, 2000, 3000, now.getUTCFullYear()); loadBudgetsDebounced(250); }}
			/>
			<button
				type="button"
				class="rounded-lg border px-2.5 py-1.5 sm:px-3 sm:py-2 text-sm transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
				on:click={() => { const y = clampInt(filterYear, 2000, 3000, now.getUTCFullYear()); const m = clampInt(filterMonth, 1, 12, now.getUTCMonth()+1); const n = nextMonth(y, m); filterYear = n.year; filterMonth = n.month; loadBudgetsDebounced(); }}
			>
				Next ›
			</button>
			<button
				type="button"
				class="rounded-lg border px-2.5 py-1.5 sm:px-4 sm:py-2 text-sm transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
					on:click={() => loadBudgetsDebounced(0)}
			>
				Refresh
			</button>
			<button
				type="button"
				class="hidden sm:inline-flex rounded-lg border px-2.5 py-1.5 sm:px-4 sm:py-2 text-sm transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
				on:click={() => { void loadRecommendations(); toasts.push({ title: 'Recommendations', description: 'Loaded 3-month averages.', variant: 'default' }); }}
				title="Load 3-month average suggestions"
			>
				Load suggestions
			</button>
			<button
				type="button"
				class="hidden sm:inline-flex rounded-lg border px-2.5 py-1.5 sm:px-4 sm:py-2 text-sm transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
				on:click={copyFromPreviousMonthOverwrite}
				title="Copy planned from last month for all categories, overwriting current planned"
			>
				Copy last month (overwrite)
			</button>
			<button
				type="button"
				class="hidden sm:inline-flex rounded-lg bg-indigo-600 px-2.5 py-1.5 sm:px-4 sm:py-2 text-sm font-semibold text-white transition hover:bg-indigo-500"
				on:click={setPlannedToLastMonthActual}
				title="Set planned to last month's actual for all categories"
			>
				Planned = last month actual
			</button>
			<button
				type="button"
				class="hidden sm:inline-flex rounded-lg bg-slate-700 px-2.5 py-1.5 sm:px-4 sm:py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
				on:click={copyFromPreviousMonth}
				title="Copy planned amounts from previous month"
			>
				Copy last month
			</button>

			<!-- Mobile-only More menu toggle -->
			<div class="relative sm:hidden">
				<button type="button" class="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-sm transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white" on:click={() => (showActionsMenu = !showActionsMenu)}>
					More
					<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="ml-1 h-4 w-4"><path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.4a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd"/></svg>
				</button>
				{#if showActionsMenu}
					<div class="absolute right-0 z-10 mt-2 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow dark:border-slate-800 dark:bg-slate-900">
						<button type="button" class="mb-1 w-full rounded-lg border px-3 py-2 text-left text-sm transition border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60" on:click={() => { showActionsMenu = false; void loadRecommendations(); toasts.push({ title: 'Recommendations', description: 'Loaded 3-month averages.', variant: 'default' }); }}>
							Load suggestions
						</button>
						<button type="button" class="mb-1 w-full rounded-lg border px-3 py-2 text-left text-sm transition border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-800/60" on:click={() => { showActionsMenu = false; copyFromPreviousMonthOverwrite(); }}>
							Copy last month (overwrite)
						</button>
						<button type="button" class="mb-1 w-full rounded-lg bg-indigo-600 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-indigo-500" on:click={() => { showActionsMenu = false; setPlannedToLastMonthActual(); }}>
							Planned = last month actual
						</button>
						<button type="button" class="w-full rounded-lg bg-slate-700 px-3 py-2 text-left text-sm font-semibold text-white transition hover:bg-slate-600" on:click={() => { showActionsMenu = false; copyFromPreviousMonth(); }}>
							Copy last month
						</button>
					</div>
				{/if}
			</div>
		</div>
	</div>

		<div class="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
				<div class="grid gap-3 grid-cols-1 sm:grid-cols-4">
					<div class="sm:col-span-2">
						<label for="budget-category-combobox" class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Category</label>
						<div class="relative mt-1">
							<input
								id="budget-category-combobox"
								type="text"
								class="w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
								placeholder="Search categories..."
								bind:value={newCategoryQuery}
								on:focus={() => (showCategoryDropdown = true)}
								on:input={() => (showCategoryDropdown = true)}
							/>
							{#if showCategoryDropdown && (hasRecents || hasOptions)}
								<div class="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow dark:border-slate-800 dark:bg-slate-900">
									{#if hasRecents}
										<div class="flex flex-wrap gap-1 p-2">
											{#each recentCategoryIds as rid}
												{#if getCategoryById(rid)}
													<button type="button" class="rounded-full border px-2 py-0.5 text-xs dark:border-slate-700" on:click={() => { const rc = getCategoryById(rid)!; newCategoryId = rid; newCategoryQuery = rc.name; showCategoryDropdown = false; }}>
														{getCategoryById(rid)!.name}
													</button>
												{/if}
											{/each}
										</div>
									{/if}
									<ul class="divide-y divide-slate-100 dark:divide-slate-800">
										{#each filteredCategoryOptions as option}
											<li>
												<button type="button" class="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800/70" on:click={() => { newCategoryId = option.id; newCategoryQuery = option.name; showCategoryDropdown = false; }}>
													<span class="truncate text-sm">{option.name}</span>
													{#if newCategoryId === option.id}
														<span class="text-xs text-emerald-600">Selected</span>
													{/if}
												</button>
											</li>
										{/each}
									</ul>
								</div>
							{/if}
						</div>
					</div>
					<div>
						<label for="budget-planned" class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Planned</label>
						<input
							id="budget-planned"
							type="number"
							step="0.01"
							min="0"
							class="mt-1 w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
							bind:value={newPlanned}
							placeholder="0.00"
						/>
					</div>
					<div class="flex items-end">
						<button
							type="button"
							class="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
								on:click={() => { if (newCategoryId) bumpRecent(Number(newCategoryId)); void createBudget(); }}
						>
							Add budget
						</button>
					</div>
				</div>
		</div>
	</div>

	<div class="relative overflow-x-auto rounded-xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/60">
		{#if loading && budgets.length > 0}
			<div class="absolute inset-0 z-10 grid place-items-center rounded-xl bg-black/5 dark:bg-black/20">
				<div class="h-6 w-6 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent"></div>
			</div>
		{/if}
		{#if loading}
			<div class="px-6 py-16 text-center text-sm text-slate-600 dark:text-slate-400">Loading budgets...</div>
		{:else if error}
			<div class="space-y-3 px-6 py-12 text-center">
				<p class="text-sm text-red-600 dark:text-red-300">{error}</p>
				<button
					type="button"
					class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
					on:click={() => loadBudgetsDebounced(0)}
				>
					Try again
				</button>
			</div>
		{:else if budgets.length === 0}
			<div class="px-6 py-16 text-center text-sm text-slate-600 dark:text-slate-400">No budgets for the selected period.</div>
		{:else}
			<table class="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
				<thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-950/80 dark:text-slate-400">
					<tr>
						<th class="px-4 py-3 text-left">Category</th>
									<th class="px-4 py-3 text-right">Planned</th>
						<th class="px-4 py-3 text-right">Actual</th>
						<th class="px-4 py-3 text-right">Remaining</th>
						<th class="px-4 py-3 text-right">Status</th>
						<th class="px-4 py-3 text-right">Suggested (Avg 3m)</th>
						<th class="px-4 py-3 text-right">Progress</th>
						<th class="px-4 py-3 text-right"></th>
					</tr>
				</thead>
				<tbody class="divide-y divide-slate-200 dark:divide-slate-900/70">
					{#each budgets as b (b.id)}
						<tr>
							<td class="px-4 py-3 text-slate-900 dark:text-slate-100">{b.categoryName}</td>
										<td class="px-4 py-3 text-right text-slate-700 dark:text-slate-200" title={currency}>
											{#if editingId === b.id}
												<div class="flex items-center justify-end gap-2">
													<input
														type="number"
														step="0.01"
														min="0"
														class="w-28 rounded-lg border px-2 py-1 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
														bind:value={plannedEdit}
													/>
													<button
														type="button"
														class="rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-60"
														on:click={() => saveEdit(b)}
														disabled={savingId === b.id}
													>Save</button>
													<button
														type="button"
														class="rounded-lg border px-3 py-1.5 text-xs transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
														on:click={cancelEdit}
														disabled={savingId === b.id}
													>Cancel</button>
												</div>
											{:else}
												<div class="flex items-center justify-end gap-2">
													<span>{fmt(b.plannedAmount)}</span>
													<button
														type="button"
														class="rounded-lg border px-2 py-1 text-xs transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
														on:click={() => startEdit(b)}
													>Edit</button>
												</div>
											{/if}
										</td>
							<td class="px-4 py-3 text-right text-slate-700 dark:text-slate-200" title={currency}>{fmt(b.actualAmount)}</td>
							<td class="px-4 py-3 text-right text-slate-700 dark:text-slate-200" title={currency}>{fmt(Math.max(0, b.plannedAmount - b.actualAmount))}</td>
							<td class="px-4 py-3 text-right">
								{#if b.actualAmount > b.plannedAmount}
									<span class="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-500">Over</span>
								{:else if b.actualAmount === b.plannedAmount && b.plannedAmount > 0}
									<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-500">At</span>
								{:else if b.plannedAmount > 0}
									<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-500">Under</span>
								{:else}
									<span class="text-xs text-slate-500">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								{#if recommendations.has(b.categoryId)}
									<div class="flex items-center justify-end gap-2">
										<span class="text-slate-700 dark:text-slate-200" title="3-month average">{fmt(recommendations.get(b.categoryId)?.avg3m ?? 0)}</span>
										<button type="button" class="rounded border px-2 py-1 text-xs dark:border-slate-800" on:click={() => applyAvg3m(b)}>Apply</button>
									</div>
								{:else}
									<span class="text-xs text-slate-500">—</span>
								{/if}
							</td>
							<td class="px-4 py-3 text-right">
								{#key `${b.actualAmount}-${b.plannedAmount}`}
									{#if b.plannedAmount > 0}
										<div class="flex items-center justify-end gap-2">
											<div class="h-2 w-40 rounded-full bg-slate-200 dark:bg-slate-800">
												<div
													class="h-2 rounded-full bg-indigo-500"
													style={`width: ${Math.min(100, Math.round((b.actualAmount / b.plannedAmount) * 100))}%`}
												></div>
											</div>
											<span class="text-xs text-slate-600 dark:text-slate-400">
												{Math.min(100, Math.round((b.actualAmount / b.plannedAmount) * 100))}%
											</span>
										</div>
									{:else}
										<span class="text-xs text-slate-500">—</span>
									{/if}
								{/key}
							</td>
							<td class="px-4 py-3 text-right">
								<button
									type="button"
									class="rounded-lg border px-3 py-1.5 text-xs transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
									title="Delete budget"
									on:click={() => deleteBudget(b.id)}
								>
									Delete
								</button>
								<div class="mt-2 flex items-center justify-end gap-1">
									<button type="button" class="rounded border px-2 py-1 text-[11px] dark:border-slate-800" on:click={() => adjustPlanned(b, -adjustStep)}>-{adjustStep}</button>
									<button type="button" class="rounded border px-2 py-1 text-[11px] dark:border-slate-800" on:click={() => adjustPlanned(b, +adjustStep)}>+{adjustStep}</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</div>

					<!-- Monthly summary and charts -->
					<div class="grid gap-6 lg:grid-cols-3">
						<div class="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60">
							<h3 class="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Summary</h3>
							<div class="space-y-2 text-sm">
								<div class="flex items-center justify-between">
									<span class="text-slate-600 dark:text-slate-400">Planned</span>
									<span class="font-semibold text-slate-900 dark:text-slate-100" title={currency}>{fmt(totalPlanned)}</span>
								</div>
								<div class="flex items-center justify-between">
									<span class="text-slate-600 dark:text-slate-400">Actual</span>
									<span class="font-semibold text-slate-900 dark:text-slate-100" title={currency}>{fmt(totalActual)}</span>
								</div>
								<div class="pt-2">
									<div class="mb-1 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
										<span>Progress</span>
										<span>{progressPct}%</span>
									</div>
									<div class="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
										<div class="h-2 rounded-full bg-emerald-500" style={`width: ${progressPct}%`}></div>
									</div>
								</div>
							</div>
						</div>
						<div class="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60 lg:col-span-2">
							<div class="grid gap-4 md:grid-cols-2" style="height: 320px;">
								<div class="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
									<h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Bar (Planned vs Actual)</h4>
									<div class="h-[260px]"><canvas bind:this={barCanvas}></canvas></div>
								</div>
								<div class="rounded-lg border border-slate-200 p-2 dark:border-slate-800">
									<h4 class="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Pie (Actual distribution)</h4>
									<div class="h-[260px]"><canvas bind:this={pieCanvas}></canvas></div>
								</div>
							</div>
						</div>
					</div>
 
