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
          ? 'border-emerald-500/40 bg-emerald-500/20 text-emerald-100'
          : toast.variant === 'error'
            ? 'border-red-500/40 bg-red-500/15 text-red-100'
            : toast.variant === 'warning'
              ? 'border-amber-500/40 bg-amber-500/20 text-amber-100'
              : 'border-slate-800 bg-slate-900/80 text-slate-100'
      } animate-toast-in`}
    >
      <p class="text-sm font-semibold">{toast.title}</p>
      {#if toast.description}
        <p class="mt-1 text-xs text-slate-200/80">{toast.description}</p>
      {/if}
    </div>
  {/each}
</div>
