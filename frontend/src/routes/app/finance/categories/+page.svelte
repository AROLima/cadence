<script lang="ts">
  import { onMount } from 'svelte';
  import { clickOutside } from '$lib/utils/clickOutside';
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
  let moreOpen = false;

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
      <h2 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Categories</h2>
      <p class="text-sm text-slate-600 dark:text-slate-400">Group transactions into a clear financial taxonomy.</p>
    </div>
    <div class="hidden sm:block">
      <button type="button" class="rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:border-indigo-700 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500" on:click={() => openCreate(null)}>
        New category
      </button>
    </div>
    <div class="sm:hidden relative" use:clickOutside={{ enabled: moreOpen, handler: () => (moreOpen = false) }}>
      <button type="button" class="rounded-lg border px-3 py-2 text-sm border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white" on:click={() => (moreOpen = !moreOpen)} aria-haspopup="menu" aria-expanded={moreOpen}>
        More
      </button>
      {#if moreOpen}
        <div class="absolute right-0 z-10 mt-2 w-44 rounded-md border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900/90">
          <button type="button" class="block w-full rounded px-2 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" on:click={() => { moreOpen = false; openCreate(null); }}>
            New category
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
    {#if loading}
      <div class="flex items-center justify-center px-6 py-16 text-sm text-slate-600 dark:text-slate-400">Loading categories...</div>
    {:else if error}
      <div class="space-y-3 px-6 py-12 text-center">
        <p class="text-sm text-rose-600 dark:text-red-300">{error}</p>
        <button
          type="button"
          class="rounded-md border border-indigo-600 bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:border-indigo-700 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          on:click={() => loadCategories()}
        >
          Try again
        </button>
      </div>
    {:else if categoryRows.length === 0}
      <div class="px-6 py-16 text-center text-sm text-slate-600 dark:text-slate-400">No categories yet. Create one to start organising transactions.</div>
    {:else}
      <table class="w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
        <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-950/80 dark:text-slate-400">
          <tr>
            <th class="px-3 md:px-4 py-2 md:py-3 text-left">Category</th>
            <th class="px-3 md:px-4 py-2 md:py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100 dark:divide-slate-900/70">
          {#each categoryRows as row (row.node.id)}
            <tr>
              <td class="px-3 md:px-4 py-2 md:py-3 text-slate-900 dark:text-slate-100">
                <div style={`padding-left: ${row.depth * 20}px`} class="flex items-center gap-2">
                  {row.node.name}
                </div>
              </td>
              <td class="px-3 md:px-4 py-2 md:py-3">
                <div class="flex gap-2">
                  <button
                    type="button"
                    class="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                    on:click={() => openEdit(row.node)}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
                    on:click={() => openCreate(row.node.id)}
                  >
                    Add child
                  </button>
                  <button
                    type="button"
                    class="rounded-md border border-rose-500/60 px-3 py-1 text-xs text-rose-700 transition hover:border-rose-600 hover:text-rose-900 dark:border-red-500/50 dark:text-red-200 dark:hover:border-red-400 dark:hover:text-white"
                    on:click={() => handleDelete(row.node)}
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
            <!-- Mobile inline actions row -->
            <tr class="sm:hidden">
              <td colspan="2" class="px-3 pb-3 text-right">
                <div class="inline-flex gap-2 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-800 dark:bg-slate-900/70">
                  <button type="button" class="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" on:click={() => openEdit(row.node)}>Edit</button>
                  <button type="button" class="rounded px-2 py-1 text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800" on:click={() => openCreate(row.node.id)}>Add child</button>
                  <button type="button" class="rounded px-2 py-1 text-rose-700 hover:bg-rose-50 dark:text-red-300 dark:hover:bg-red-900/30" on:click={() => handleDelete(row.node)}>Delete</button>
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
