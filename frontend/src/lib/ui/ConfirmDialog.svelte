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

    <div class="relative w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-slate-900/60">
      <div class="flex items-start gap-3">
        <div class={`rounded-lg ${destructive ? 'bg-red-500/20 text-red-200' : 'bg-indigo-500/20 text-indigo-200'} p-2`}>
          <AlertTriangle class="h-5 w-5" />
        </div>
        <div class="space-y-1">
          <h3 class="text-lg font-semibold text-slate-100">{title}</h3>
          {#if description}
            <p class="text-sm text-slate-400">{description}</p>
          {/if}
        </div>
      </div>

      <div class="mt-6 flex items-center justify-end gap-3 text-sm">
        <button
          type="button"
          class="rounded-lg border border-slate-700 px-4 py-2 text-slate-200 transition hover:border-slate-500 hover:text-white"
          onclick={cancel}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          class={`rounded-lg px-4 py-2 font-medium transition ${
            destructive
              ? 'bg-red-500 text-white hover:bg-red-600'
              : 'bg-indigo-500 text-white hover:bg-indigo-600'
          }`}
          onclick={confirm}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
{/if}
