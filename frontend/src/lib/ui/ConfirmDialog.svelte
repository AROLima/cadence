<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import AlertTriangle from '$lib/icons/AlertTriangle.svelte';

  export let open = false;
  export let title = 'Confirm your action';
  export let description: string | undefined;
  export let confirmLabel = 'Confirm';
  export let cancelLabel = 'Cancel';
  export let destructive = false;

  const dispatch = createEventDispatcher<{ confirm: void; cancel: void; close: void }>();

  const cancel = () => {
    dispatch('cancel');
    dispatch('close');
  };

  const confirm = () => {
    dispatch('confirm');
    dispatch('close');
  };
</script>

{#if open}
  <div class="fixed inset-0 z-[100] flex items-center justify-center px-4">
    <button
      type="button"
      class="absolute inset-0 bg-slate-950/70 backdrop-blur-sm"
      aria-label="Close dialog"
      onclick={cancel}
    ></button>

    <div class="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-slate-900 shadow-2xl shadow-slate-900/10 dark:border-slate-800 dark:bg-slate-950/95 dark:text-slate-100 dark:shadow-slate-900/60">
      <div class="flex items-start gap-3">
        <div class={`rounded-lg p-2 ${destructive ? 'bg-red-50 text-red-700 dark:bg-red-500/20 dark:text-red-200' : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-200'}`}>
          <AlertTriangle class="h-5 w-5" />
        </div>
        <div class="space-y-1">
          <h3 class="text-lg font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          {#if description}
            <p class="text-sm text-slate-600 dark:text-slate-400">{description}</p>
          {/if}
        </div>
      </div>

      <div class="mt-6 flex items-center justify-end gap-3 text-sm">
        <button
          type="button"
          class="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
          onclick={cancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          class={`rounded-lg px-4 py-2 font-medium transition ${
            destructive
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-indigo-600 text-white hover:bg-indigo-700'
          }`}
          onclick={confirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
