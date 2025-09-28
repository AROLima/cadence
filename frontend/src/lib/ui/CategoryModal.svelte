<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { CategoryPayload } from '$lib/types/finance';

  type CategoryFormContext = {
    id: number;
    name: string;
    parentId: number | null;
  };

  export let open = false;
  export let category: CategoryFormContext | null = null;
  export let parentOptions: { id: number; name: string }[] = [];
  export let initialParentId: number | null = null;
  export let isSaving = false;

  const dispatch = createEventDispatcher<{
    close: void;
    submit: CategoryPayload;
  }>();

  type FormState = {
    name: string;
    parentId: string;
  };

  let form: FormState = {
    name: '',
    parentId: '',
  };

  let syncKey: string | null = null;

  const computeKey = () => {
    if (!open) return null;
    if (category) {
      return `category-${category.id}`;
    }
    return initialParentId !== null ? `create-${initialParentId}` : 'create-root';
  };

  const resetForm = () => {
    form = {
      name: '',
      parentId: initialParentId !== null ? String(initialParentId) : '',
    };
  };

  const hydrateFromCategory = (value: CategoryFormContext) => {
    form = {
      name: value.name,
      parentId: value.parentId !== null && value.parentId !== undefined ? String(value.parentId) : '',
    };
  };

  $: currentKey = computeKey();
  $: if (open) {
    if (currentKey !== syncKey) {
      if (category) {
        hydrateFromCategory(category);
      } else {
        resetForm();
      }
      syncKey = currentKey;
    }
  } else if (syncKey) {
    syncKey = null;
  }

  const close = () => {
    if (isSaving) return;
    dispatch('close');
  };

  const handleSubmit = () => {
    if (!form.name.trim()) {
      return;
    }

    const rawParent = form.parentId === '' ? null : Number(form.parentId);
    const parentId = rawParent !== null && Number.isFinite(rawParent) ? rawParent : null;

    const payload: CategoryPayload = {
      name: form.name.trim(),
      parentId,
    };

    dispatch('submit', payload);
  };
</script>

{#if open}
  <div class="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm">
    <button
      type="button"
      class="absolute inset-0 cursor-default"
      aria-label="Close category modal"
      on:click={close}
    ></button>

    <div class="relative z-[121] w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-slate-900/70">
      <div class="mb-6 flex items-center justify-between">
        <div>
          <h2 class="text-xl font-semibold text-slate-100">{category ? 'Edit Category' : 'New Category'}</h2>
          <p class="text-xs text-slate-500">Organize transactions with clear category hierarchy.</p>
        </div>
        <button
          type="button"
          class="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
          on:click={close}
          disabled={isSaving}
        >
          Close
        </button>
      </div>

      <form class="space-y-4" on:submit|preventDefault={handleSubmit}>
        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-200" for="category-name">Name</label>
          <input
            id="category-name"
            class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            placeholder="Utilities"
            bind:value={form.name}
            required
          />
        </div>

        <div class="space-y-2">
          <label class="text-sm font-medium text-slate-200" for="category-parent">Parent category</label>
          <select
            id="category-parent"
            class="w-full rounded-lg border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            bind:value={form.parentId}
          >
            <option value="">No parent</option>
            {#each parentOptions as option}
              <option value={option.id}>{option.name}</option>
            {/each}
          </select>
        </div>

        <div class="flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
            on:click={close}
            disabled={isSaving}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
            disabled={isSaving || !form.name.trim()}
          >
            {isSaving ? 'Saving...' : category ? 'Save changes' : 'Create category'}
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}
