<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onMount, onDestroy } from 'svelte';
  import Menu from '$lib/icons/Menu.svelte';
  import X from '$lib/icons/X.svelte';
  import LogOut from '$lib/icons/LogOut.svelte';
  import LayoutDashboard from '$lib/icons/LayoutDashboard.svelte';
  import ListChecks from '$lib/icons/ListChecks.svelte';
  import Wallet from '$lib/icons/Wallet.svelte';
  import Receipt from '$lib/icons/Receipt.svelte';
  import PiggyBank from '$lib/icons/PiggyBank.svelte';
  import CreditCard from '$lib/icons/CreditCard.svelte';
  import Settings from '$lib/icons/Settings.svelte';
  import type { Component } from 'svelte';
  import type { NavSection, ResolvableIcon } from '$lib/ui/types';

  export let navigation: NavSection[] = [];
  export let user: {
    name?: string | null;
    email?: string | null;
    avatarUrl?: string | null;
  } = {};
  export let title = 'Workspace';
  export let onLogout: (() => void | Promise<void>) | undefined;

  let sidebarOpen = false;
  $: pathname = $page.url.pathname;
  let softLight = false;

  const iconRegistry: Record<string, Component | undefined> = {
    dashboard: LayoutDashboard,
    tasks: ListChecks,
    finance: Wallet,
    transactions: Receipt,
    accounts: CreditCard,
    categories: PiggyBank,
    budgets: PiggyBank,
    settings: Settings,
    logout: LogOut,
  };

  const resolveIcon = (icon?: ResolvableIcon) => {
    if (!icon) return undefined;
    if (typeof icon === 'string') {
      return iconRegistry[icon];
    }
    return icon;
  };

  const closeSidebar = () => {
    sidebarOpen = false;
  };

  const toggleSidebar = () => {
    sidebarOpen = !sidebarOpen;
  };

  const navigate = async (href: string) => {
    closeSidebar();
    if (browser) {
      await goto(href);
    }
  };

  const handleLogout = async () => {
    if (onLogout) {
      await onLogout();
    }
    closeSidebar();
  };

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  // Track theme toggles to enable a gentler light mode wrapper
  let mo: MutationObserver | null = null;
  onMount(() => {
    if (!browser) return;
    const update = () => {
      softLight = !document.documentElement.classList.contains('dark');
    };
    update();
    mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  });
  onDestroy(() => {
    mo?.disconnect();
    mo = null;
  });
</script>

<div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100" class:soft-light={softLight}>
  <div class="flex min-h-screen">
    {#if sidebarOpen}
      <button
        type="button"
        class="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-[2px] md:hidden dark:bg-slate-950/70"
        aria-label="Close navigation"
        on:click={closeSidebar}
      ></button>
    {/if}

    <aside
      class={`fixed inset-y-0 left-0 z-40 w-72 transform border-r px-5 py-6 transition-transform duration-200
        border-slate-200 bg-white shadow-sm md:px-6 dark:border-slate-800 dark:bg-slate-900
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}
    >
      <div class="flex items-center justify-between md:justify-start md:gap-2">
        <div>
          <p class="text-xs uppercase tracking-wider text-slate-500">Cadence</p>
          <h1 class="text-lg font-semibold">{title}</h1>
        </div>

        <button
          class="md:hidden rounded-lg border p-2 text-slate-700 border-slate-300 dark:border-slate-800 dark:text-slate-300"
          type="button"
          aria-label="Close sidebar"
          on:click={closeSidebar}
        >
          <X class="h-4 w-4" />
        </button>
      </div>

      <nav class="mt-8 space-y-6 text-sm">
        {#each navigation as section}
          {#if 'items' in section}
            <div class="space-y-2">
              <div class="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
                {#if resolveIcon(section.icon)}
                  <svelte:component this={resolveIcon(section.icon)} class="h-3.5 w-3.5" />
                {/if}
                <span>{section.label}</span>
              </div>
              <div class="space-y-1.5">
                {#each section.items as link}
                  <button
                    type="button"
                    class={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white ${
                      isActive(link.href) ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:ring-0' : 'text-slate-700'
                    }`}
                    on:click={() => navigate(link.href)}
                  >
                    <span class="flex items-center gap-2">
                      {#if resolveIcon(link.icon)}
                        <svelte:component this={resolveIcon(link.icon)} class="h-4 w-4" />
                      {/if}
                      {link.label}
                    </span>
                    {#if link.badge}
                      <span class="rounded-full bg-indigo-100 px-2 text-xs text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                        {link.badge}
                      </span>
                    {/if}
                  </button>
                {/each}
              </div>
            </div>
          {:else}
            <button
              type="button"
              class={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/80 dark:hover:text-white ${
                isActive(section.href) ? 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:ring-0' : 'text-slate-700'
              }`}
              on:click={() => navigate(section.href)}
            >
              <span class="flex items-center gap-2">
                {#if resolveIcon(section.icon)}
                  <svelte:component this={resolveIcon(section.icon)} class="h-4 w-4" />
                {/if}
                {section.label}
              </span>
              {#if section.badge}
                <span class="rounded-full bg-indigo-100 px-2 text-xs text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200">
                  {section.badge}
                </span>
              {/if}
            </button>
          {/if}
        {/each}
      </nav>
    </aside>

    <main class="flex-1 md:ml-72">
  <header class="flex items-center justify-between border-b px-4 py-3 md:px-6 md:py-4 border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center gap-3">
          <button
            class="rounded-lg border p-2 md:hidden border-slate-300 text-slate-700 dark:border-slate-800 dark:text-slate-200"
            type="button"
            aria-label="Toggle navigation"
            on:click={toggleSidebar}
          >
            <Menu class="h-4 w-4" />
          </button>
          <div>
            <p class="text-sm font-semibold text-slate-900 dark:text-slate-100">{user?.name ?? 'User'}</p>
            <p class="text-xs text-slate-600 dark:text-slate-400">{user?.email ?? ''}</p>
          </div>
        </div>

        <button
          class="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
          type="button"
          on:click={handleLogout}
        >
          <LogOut class="h-4 w-4" />
          Logout
        </button>
      </header>

      <section class="p-4 md:p-6">
        <slot />
      </section>
    </main>
  </div>
</div>

<style>
  /* Soften stark whites in light mode without touching dark theme */
  :global(.soft-light .bg-white) {
    /* slate-100 */
    background-color: rgb(241 245 249) !important;
  }
  :global(.soft-light .bg-white\/70) {
    /* slate-100 with a bit of transparency */
    background-color: rgba(241, 245, 249, 0.95) !important;
  }
  :global(.soft-light .shadow-sm) {
    /* slightly softer shadow to match softer surfaces */
    --tw-shadow: 0 1px 2px 0 rgb(15 23 42 / 0.04);
    --tw-shadow-colored: 0 1px 2px 0 var(--tw-shadow-color);
    box-shadow: var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);
  }
  /* Inputs/buttons that use bg-white */
  :global(.soft-light select.bg-white),
  :global(.soft-light input.bg-white),
  :global(.soft-light textarea.bg-white) {
    background-color: rgb(241 245 249) !important;
  }
  /* Tables using bg-white/70 wrappers */
  :global(.soft-light .bg-white\/70 [class*='divide-']) {
    /* keep separators subtle */
    --tw-divide-opacity: 1;
    border-color: rgb(226 232 240 / var(--tw-divide-opacity));
  }
</style>
