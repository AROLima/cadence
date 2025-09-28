<script lang="ts">
  import { onMount } from 'svelte';
  import CategoryModal from '$lib/ui/CategoryModal.svelte';
  import { toasts } from '$lib/ui/toast';
  import {
    getCategoryTree,
    createCategory,
    updateCategory,
    deleteCategory,
  } from '$lib/api/finance';
  import type { FinanceCategoryNode, CategoryPayload } from '$lib/types/finance';

  type CategoryRow = {
    node: FinanceCategoryNode;
    depth: number;
  };

  let loading = false;
  let error: string | null = null;
  let categories: FinanceCategoryNode[] = [];

  let modalOpen = false;
  let modalSaving = false;
  let editingCategory: { id: number; name: string; parentId: number | null } | null = null;
  let modalParentOptions: { id: number; name: string }[] = [];
  let modalInitialParent: number | null = null;

  onMount(() => {
    void loadCategories();
  });

  async function loadCategories() {
    loading = true;
    error = null;
    try {
      categories = await getCategoryTree();
    } catch (err) {
      console.error('[categories] failed to load', err);
      error = err instanceof Error ? err.message : 'Failed to load categories';
      toasts.push({ title: 'Categories', description: error, variant: 'error' });
    } finally {
      loading = false;
    }
  }

  const flattenTree = (nodes: FinanceCategoryNode[], depth = 0, list: CategoryRow[] = []) => {
    nodes.forEach((node) => {
      list.push({ node, depth });
      if (node.children?.length) {
        flattenTree(node.children, depth + 1, list);
      }
    });
    return list;
  };

  $: categoryRows = flattenTree(categories);

  const buildOptions = (excludeIds: Set<number> = new Set()): { id: number; name: string }[] => {
    const rows = flattenTree(categories);
    return rows
      .filter((row) => !excludeIds.has(row.node.id))
      .map((row) => {
        const spacer = row.depth ? `${'  '.repeat(row.depth * 2)}- ` : '';
        return { id: row.node.id, name: `${spacer}${row.node.name}` };
      });
  };

  const collectDescendantIds = (node: FinanceCategoryNode, bucket: Set<number>) => {
    node.children?.forEach((child) => {
      bucket.add(child.id);
      collectDescendantIds(child, bucket);
    });
  };

  const openCreate = (parentId: number | null = null) => {
    editingCategory = null;
    modalInitialParent = parentId;
    modalParentOptions = buildOptions();
    modalOpen = true;
  };

  const openEdit = (node: FinanceCategoryNode) => {
    editingCategory = { id: node.id, name: node.name, parentId: node.parentId ?? null };
    const exclude = new Set<number>([node.id]);
    collectDescendantIds(node, exclude);
    modalParentOptions = buildOptions(exclude);
    modalInitialParent = node.parentId ?? null;
    modalOpen = true;
  };

  const closeModal = () => {
    if (modalSaving) return;
    modalOpen = false;
    editingCategory = null;
    modalInitialParent = null;
    modalParentOptions = [];
  };

  const handleSubmit = async (event: CustomEvent<CategoryPayload>) => {
    modalSaving = true;
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, event.detail);
        toasts.push({ title: 'Category updated', variant: 'success' });
      } else {
        await createCategory(event.detail);
        toasts.push({ title: 'Category created', variant: 'success' });
      }
      modalOpen = false;
      editingCategory = null;
      await loadCategories();
    } catch (err) {
      console.error('[categories] save failed', err);
      const message = err instanceof Error ? err.message : 'Failed to save category';
      toasts.push({ title: 'Save failed', description: message, variant: 'error' });
    } finally {
      modalSaving = false;
    }
  };

  const handleDelete = async (node: FinanceCategoryNode) => {
    const hasChildren = node.children && node.children.length > 0;
    const confirmed = window.confirm(
      hasChildren
        ? `Delete category "${node.name}" and all nested categories?`
        : `Delete category "${node.name}"?`,
    );
    if (!confirmed) {
      return;
    }

    try {
      await deleteCategory(node.id);
      toasts.push({ title: 'Category deleted', variant: 'success' });
      await loadCategories();
    } catch (err) {
      console.error('[categories] delete failed', err);
      const message = err instanceof Error ? err.message : 'Failed to delete category';
      toasts.push({ title: 'Delete failed', description: message, variant: 'error' });
    }
  };
</script>

<div class="space-y-6">
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 class="text-2xl font-semibold text-slate-100">Categories</h2>
      <p class="text-sm text-slate-400">Group transactions into a clear financial taxonomy.</p>
    </div>
    <button
      type="button"
      class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
      on:click={() => openCreate(null)}
    >
      New category
    </button>
  </div>

  <div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
    {#if loading}
      <div class="flex items-center justify-center px-6 py-16 text-sm text-slate-400">Loading categories...</div>
    {:else if error}
      <div class="space-y-3 px-6 py-12 text-center">
        <p class="text-sm text-red-300">{error}</p>
        <button
          type="button"
          class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
          on:click={() => loadCategories()}
        >
          Try again
        </button>
      </div>
    {:else if categoryRows.length === 0}
      <div class="px-6 py-16 text-center text-sm text-slate-400">No categories yet. Create one to start organising transactions.</div>
    {:else}
      <table class="w-full divide-y divide-slate-800 text-sm">
        <thead class="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th class="px-4 py-3 text-left">Category</th>
            <th class="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-900/70">
          {#each categoryRows as row (row.node.id)}
            <tr>
              <td class="px-4 py-3 text-slate-100">
                <div style={`padding-left: ${row.depth * 20}px`} class="flex items-center gap-2">
                  {row.node.name}
                </div>
              </td>
              <td class="px-4 py-3">
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white"
                    on:click={() => openEdit(row.node)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-slate-700 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white"
                    on:click={() => openCreate(row.node.id)}
                  >
                    Add child
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-red-500/50 px-3 py-1 text-xs text-red-200 transition hover:border-red-400 hover:text-white"
                    on:click={() => handleDelete(row.node)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</div>

<CategoryModal
  open={modalOpen}
  category={editingCategory}
  parentOptions={modalParentOptions}
  initialParentId={modalInitialParent}
  isSaving={modalSaving}
  on:close={closeModal}
  on:submit={handleSubmit}
/>
