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

  const navigation: NavSection[] = [
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
    { href: '/app/settings', label: 'Settings', icon: 'settings' },
  ];

  if (browser) {
    $effect(() => {
      authStore.setAuth({
        user: data.user,
        accessToken: data.tokens.accessToken,
        refreshToken: data.tokens.refreshToken,
      });
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

<AppShell {navigation} user={data.user} onLogout={handleLogout} title="Finace">
  <slot />
</AppShell>
