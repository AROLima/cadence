<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { getMySettings, updateMySettings, type MySettings } from '$lib/api/me';
	import { browser } from '$app/environment';
	import { getCurrencyOptions } from '$lib/utils/currency';

	let loading = true;
	let saving = false;
	let error: string | null = null;
	let saved = false;

	const timezones = Intl.supportedValuesOf?.('timeZone') ?? ['UTC'];
	const locales = ['en-US', 'pt-BR', 'es-ES'];
	const currencies = getCurrencyOptions();

	let settings: MySettings = {
		theme: 'system',
		locale: 'en-US',
		timezone: 'UTC',
		weekStart: 'monday',
		notifications: { email: true, push: false },
		currency: 'USD',
	};

	function applyTheme(theme: MySettings['theme']) {
		if (!browser) return;
		const root = document.documentElement;
		const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
		const useDark = theme === 'dark' || (theme === 'system' && prefersDark);
		root.classList.toggle('dark', !!useDark);
		try {
			localStorage.setItem('theme', theme);
		} catch (_) {
			// ignore storage errors
		}
	}

	// Keep in sync with system preference when in system mode
	let mq: MediaQueryList | null = null;
	let mqListener: ((this: MediaQueryList, ev: MediaQueryListEvent) => any) | null = null;
	function attachSystemListener() {
		if (!browser) return;
		if (mq) return; // already attached
		mq = window.matchMedia('(prefers-color-scheme: dark)');
		mqListener = () => {
			if (settings.theme === 'system') applyTheme('system');
		};
		mq.addEventListener?.('change', mqListener);
	}
	onDestroy(() => {
		if (mq && mqListener) mq.removeEventListener?.('change', mqListener as any);
	});

	async function load() {
		loading = true;
		error = null;
		try {
			settings = await getMySettings();
			// Do NOT auto-apply theme on load to avoid surprising switches when opening Settings.
			// The current theme comes from early init (app.html) and stays until user changes it here.
			if (settings.theme === 'system') attachSystemListener();
		} catch (e) {
			error = 'Failed to load settings';
			console.error(e);
		} finally {
			loading = false;
		}
	}

	async function save() {
		saving = true;
		saved = false;
		error = null;
		try {
			settings = await updateMySettings(settings);
			// Apply chosen theme after a successful save to reflect the user's explicit choice
			applyTheme(settings.theme);
			saved = true;
			setTimeout(() => (saved = false), 2000);
		} catch (e) {
			error = 'Failed to save settings';
			console.error(e);
		} finally {
			saving = false;
		}
	}

	onMount(load);
</script>

	<h2 class="text-2xl font-semibold mb-2 text-slate-900 dark:text-slate-100">Settings</h2>
	<p class="text-sm text-slate-600 dark:text-slate-400 mb-6">Perfil e Aparência</p>

	{#if loading}
	  <p class="text-slate-600 dark:text-slate-400">Loading…</p>
	{:else}
		{#if error}
			<div class="p-3 rounded-lg border border-red-300 bg-red-50 text-red-700 mb-4">{error}</div>
		{/if}

		<div class="grid gap-6 max-w-3xl">
			<section class="rounded-xl border bg-white border-slate-200 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
				<h3 class="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Aparência</h3>

	      <div class="grid md:grid-cols-2 gap-4">
					<label class="block">
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">Tema</span>
						<select class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" bind:value={settings.theme} on:change={() => applyTheme(settings.theme)}>
	            <option value="system">Sistema</option>
	            <option value="light">Claro</option>
	            <option value="dark">Escuro</option>
	          </select>
	        </label>

					<label class="block">
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">Idioma</span>
						<select class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" bind:value={settings.locale}>
	            {#each locales as l}
	              <option value={l}>{l}</option>
	            {/each}
	          </select>
	        </label>

					<label class="block md:col-span-2">
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">Fuso horário</span>
						<select class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" bind:value={settings.timezone}>
	            {#each timezones as tz}
	              <option value={tz}>{tz}</option>
	            {/each}
	          </select>
	        </label>

					<label class="block">
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">Moeda</span>
						<select class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" bind:value={settings.currency}>
	            {#each currencies as c}
	              <option value={c.code}>{c.code} – {c.symbol} {c.name}</option>
	            {/each}
	          </select>
	        </label>

					<label class="block">
						<span class="text-sm font-medium text-slate-700 dark:text-slate-300">Início da semana</span>
						<select class="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" bind:value={settings.weekStart}>
	            <option value="monday">Segunda</option>
	            <option value="sunday">Domingo</option>
	          </select>
	        </label>
	      </div>
	    </section>

			<section class="rounded-xl border bg-white border-slate-200 p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
				<h3 class="text-base font-semibold text-slate-900 dark:text-slate-100 mb-4">Notificações</h3>
				<div class="space-y-3">
					<label class="flex items-center gap-3 text-slate-800 dark:text-slate-200">
						<input class="cb" type="checkbox" bind:checked={settings.notifications.email} />
						<span>Email</span>
					</label>
					<label class="flex items-center gap-3 text-slate-800 dark:text-slate-200">
						<input class="cb" type="checkbox" bind:checked={settings.notifications.push} />
						<span>Push/Browser</span>
					</label>
				</div>
			</section>

			<div class="flex items-center gap-3">
				<button class="inline-flex items-center justify-center gap-2 rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:border-indigo-700 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60" disabled={saving} on:click|preventDefault={save}>
					{saving ? 'Salvando…' : 'Salvar'}
				</button>
				{#if saved}
					<span class="text-sm text-green-600">Salvo!</span>
				{/if}
			</div>
	  </div>
	{/if}

