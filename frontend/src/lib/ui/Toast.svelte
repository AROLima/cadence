<script lang="ts">
  import { onDestroy } from 'svelte';
  import { toasts } from '$lib/ui/toast';
  import type { Toast } from '$lib/ui/toast';

  export let limit = 4;

  let items: Toast[] = [];
  const unsubscribe = toasts.subscribe((list) => {
    items = limit > 0 ? list.slice(-limit) : [...list];
  });

  onDestroy(unsubscribe);
</script>

<div class="pointer-events-none fixed inset-x-0 top-4 z-[200] flex w-full flex-col items-center gap-3 px-4 sm:items-end sm:px-6">
  {#each items as toast (toast.id)}
    <div
      class={`pointer-events-auto w-full max-w-sm rounded-xl border px-4 py-3 shadow-toast backdrop-blur ${
        toast.variant === 'success'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/40 dark:bg-emerald-500/20 dark:text-emerald-100'
          : toast.variant === 'error'
            ? 'border-red-200 bg-red-50 text-rose-800 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-100'
            : toast.variant === 'warning'
              ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/20 dark:text-amber-100'
              : 'border-slate-200 bg-white text-slate-900 dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100'
      } animate-toast-in`}
    >
      <p class="text-sm font-semibold">{toast.title}</p>
      {#if toast.description}
        <p class="mt-1 text-xs text-slate-600 dark:text-slate-200/80">{toast.description}</p>
      {/if}
    </div>
  {/each}
</div>
