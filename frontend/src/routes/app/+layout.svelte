<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import AppShell from '$lib/ui/AppShell.svelte';
  import type { NavSection } from '$lib/ui/types';
  import { authStore } from '$lib/stores/auth';

  export let data: {
    user: Record<string, unknown>;
    tokens: { accessToken: string; refreshToken: string | null };
  };

  let navigation: NavSection[] = [];
  $: {
    const isAdmin = (data.user as any)?.role === 'ADMIN';
    const base: NavSection[] = [
      { href: '/app/dashboard', label: 'Dashboard', icon: 'dashboard' },
      { href: '/app/tasks', label: 'Tasks', icon: 'tasks' },
      {
        label: 'Finance',
        icon: 'finance',
        items: [
          { href: '/app/finance/transactions', label: 'Transactions', icon: 'transactions' },
          { href: '/app/finance/accounts', label: 'Accounts', icon: 'accounts' },
          { href: '/app/finance/categories', label: 'Categories', icon: 'categories' },
          { href: '/app/finance/budgets', label: 'Budgets', icon: 'budgets' },
        ],
      },
    ];
    if (isAdmin) {
      base.push({ href: '/app/admin', label: 'Admin', icon: 'settings' });
    }
    base.push({ href: '/app/settings', label: 'Settings', icon: 'settings' });
    navigation = base;
  }

  if (browser) {
    authStore.setAuth({
      user: data.user,
      accessToken: data.tokens.accessToken,
      refreshToken: data.tokens.refreshToken,
    });
  }

  const handleLogout = async () => {
    try {
      await fetch('/logout', { method: 'POST' });
    } finally {
      authStore.clearAuth();
      if (browser) {
        await goto('/login');
      }
    }
  };
</script>

<AppShell {navigation} user={data.user} onLogout={handleLogout} title="Cadence">
  <slot />
</AppShell>
