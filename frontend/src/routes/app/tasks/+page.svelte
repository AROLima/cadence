<script lang="ts">
  import { onMount } from 'svelte';
  import TaskDrawer from '$lib/ui/TaskDrawer.svelte';
  import type { TaskDrawerMode } from '$lib/types/tasks';
  import { toasts } from '$lib/ui/toast';
  import {
    createTask,
    updateTask,
    listTasks,
    listTaskComments,
    createTaskComment,
    deleteTask,
  } from '$lib/api/tasks';
  import type { TaskComment, TaskItem, TaskPriority, TaskStatus } from '$lib/types/tasks';
  import {
    TASK_PRIORITY_OPTIONS,
    TASK_STATUS_OPTIONS,
  } from '$lib/types/tasks';
  import type { TaskFilters, TaskPayload } from '$lib/api/tasks';
  import ChevronDown from '$lib/icons/ChevronDown.svelte';
  import ChevronRight from '$lib/icons/ChevronRight.svelte';
  import Plus from '$lib/icons/Plus.svelte';
  import Check from '$lib/icons/Check.svelte';
  import RefreshCw from '$lib/icons/RefreshCw.svelte';

  let loading = false;
  let error: string | null = null;

  let tasks: TaskItem[] = [];
  let page = 1;
  let pageSize = 20;
  let pageCount = 1;
  let total = 0;

  let statusFilter: TaskStatus[] = [];
  let priorityFilter: TaskPriority[] = [];
  let includeSubtasks = false;
  let dueFrom = '';
  let dueTo = '';
  let search = '';

  let drawerOpen = false;
  let drawerMode: TaskDrawerMode = 'create';
  let selectedTask: TaskItem | null = null;
  let drawerParent: TaskItem | null = null;
  let drawerComments: TaskComment[] = [];
  let commentsLoading = false;
  let isSaving = false;
  let isCommentSubmitting = false;

  let expandedTasks = new Set<number>();
  let actionPending = new Set<number>();
  let selectedIds = new Set<number>();
  let bulkPending = false;
  let autoSelectSubtasks = true;

  const today = new Date();

  onMount(() => {
    void loadTasks(true);
  });

  const buildFilters = (): TaskFilters => {
    const filters: TaskFilters = {};
    if (statusFilter.length) {
      filters.status = [...statusFilter];
    }
    if (priorityFilter.length) {
      filters.priority = [...priorityFilter];
    }
    if (includeSubtasks) {
      filters.includeSubtasks = includeSubtasks;
    }
    if (search.trim()) {
      filters.q = search.trim();
    }
    if (dueFrom) {
      filters.dueFrom = new Date(`${dueFrom}T00:00:00`).toISOString();
    }
    if (dueTo) {
      filters.dueTo = new Date(`${dueTo}T23:59:59`).toISOString();
    }
    return filters;
  };

  async function loadTasks(resetPage = false) {
    if (resetPage) {
      page = 1;
    }
    loading = true;
    error = null;

    try {
      const result = await listTasks(buildFilters(), { page, pageSize });
      tasks = result.items;
      const meta = result.meta ?? {
        page,
        pageSize,
        total: result.items.length,
        pageCount: Math.max(1, Math.ceil(result.items.length / pageSize)),
      };
      page = Number(meta.page ?? page) || 1;
      pageSize = Number(meta.pageSize ?? pageSize) || 20;
      total = Number(meta.total ?? result.items.length) || result.items.length;
      pageCount = Number(meta.pageCount ?? Math.max(1, Math.ceil(total / pageSize))) || 1;
      expandedTasks = new Set<number>();
      selectedIds = new Set<number>();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load tasks';
      toasts.push({ title: 'Tasks', description: error, variant: 'error' });
    } finally {
      loading = false;
    }
  }

  const toggleCollectionValue = <T extends string>(values: T[], candidate: T): T[] => {
    return values.includes(candidate)
      ? values.filter((value) => value !== candidate)
      : [...values, candidate];
  };

  const toggleStatus = (status: TaskStatus) => {
    statusFilter = toggleCollectionValue(statusFilter, status);
  };

  const togglePriority = (priority: TaskPriority) => {
    priorityFilter = toggleCollectionValue(priorityFilter, priority);
  };

  const resetFilters = () => {
    statusFilter = [];
    priorityFilter = [];
    includeSubtasks = false;
    dueFrom = '';
    dueTo = '';
    search = '';
    void loadTasks(true);
  };

  const applyFilters = () => {
    void loadTasks(true);
  };

  const toggleTaskExpansion = (taskId: number) => {
    const next = new Set(expandedTasks);
    if (next.has(taskId)) {
      next.delete(taskId);
    } else {
      next.add(taskId);
    }
    expandedTasks = next;
  };

  const setActionPending = (taskId: number, pending: boolean) => {
    const next = new Set(actionPending);
    if (pending) {
      next.add(taskId);
    } else {
      next.delete(taskId);
    }
    actionPending = next;
  };

  const isActionPending = (taskId: number) => actionPending.has(taskId);

  const updateTaskInTree = (items: TaskItem[], updated: TaskItem): TaskItem[] => {
    return items.map((item) => {
      if (item.id === updated.id) {
        return { ...updated };
      }
      if (item.subtasks?.length) {
        return {
          ...item,
          subtasks: updateTaskInTree(item.subtasks, updated),
        };
      }
      return item;
    });
  };

  const removeTaskFromTree = (items: TaskItem[], removeId: number): TaskItem[] => {
    return items
      .filter((item) => item.id !== removeId)
      .map((item) => ({
        ...item,
        subtasks: item.subtasks?.length ? removeTaskFromTree(item.subtasks, removeId) : item.subtasks,
      }));
  };

  // Selection helpers
  const findTaskInTree = (items: TaskItem[], id: number): TaskItem | null => {
    for (const item of items) {
      if (item.id === id) return item;
      if (item.subtasks?.length) {
        const found = findTaskInTree(item.subtasks, id);
        if (found) return found;
      }
    }
    return null;
  };

  const getDescendantIds = (task?: TaskItem | null): number[] => {
    if (!task || !task.subtasks?.length) return [];
    const ids: number[] = [];
    const stack = [...task.subtasks];
    while (stack.length) {
      const current = stack.pop()!;
      ids.push(current.id);
      if (current.subtasks?.length) stack.push(...current.subtasks);
    }
    return ids;
  };

  const toggleSelect = (taskId: number) => {
    const next = new Set(selectedIds);
    const selecting = !next.has(taskId);
    if (selecting) next.add(taskId);
    else next.delete(taskId);

    if (autoSelectSubtasks) {
      const task = findTaskInTree(tasks, taskId);
      const descendants = getDescendantIds(task);
      if (descendants.length) {
        if (selecting) {
          descendants.forEach((id) => next.add(id));
        } else {
          descendants.forEach((id) => next.delete(id));
        }
      }
    }

    selectedIds = next;
  };
  const isSelected = (taskId: number) => selectedIds.has(taskId);
  const clearSelection = () => (selectedIds = new Set<number>());

  const handleQuickUpdate = async (task: TaskItem, payload: Partial<TaskPayload>) => {
    setActionPending(task.id, true);
    try {
      const updated = await updateTask(task.id, payload);
      tasks = updateTaskInTree(tasks, updated);
      toasts.push({
        title: 'Task updated',
        description: `"${updated.title}" was updated successfully.`,
        variant: 'success',
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update task';
      toasts.push({ title: 'Update failed', description: message, variant: 'error' });
    } finally {
      setActionPending(task.id, false);
    }
  };

  const toggleTaskCompleted = (task: TaskItem) => {
    const next = task.status === 'COMPLETED' ? 'TODO' : 'COMPLETED';
    void handleQuickUpdate(task, { status: next });
  };

  const handlePriorityChange = (task: TaskItem, event: Event) => {
    const select = event.target as HTMLSelectElement;
    const nextPriority = select.value as TaskPriority;
    if (nextPriority === task.priority) {
      return;
    }
    void handleQuickUpdate(task, { priority: nextPriority });
  };

  const handleDelete = async (task: TaskItem) => {
    const confirmed = window.confirm(`Delete task "${task.title}"? This cannot be undone.`);
    if (!confirmed) return;
    setActionPending(task.id, true);
    try {
      await deleteTask(task.id);
      tasks = removeTaskFromTree(tasks, task.id);
      toasts.push({ title: 'Task deleted', variant: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete task';
      toasts.push({ title: 'Delete failed', description: message, variant: 'error' });
    } finally {
      setActionPending(task.id, false);
    }
  };

  const openCreateDrawer = () => {
    drawerMode = 'create';
    drawerParent = null;
    selectedTask = null;
    drawerComments = [];
    commentsLoading = false;
    drawerOpen = true;
  };

  const openEditDrawer = async (task: TaskItem) => {
    drawerMode = 'edit';
    selectedTask = task;
    drawerParent = null;
    drawerComments = [];
    drawerOpen = true;
    commentsLoading = true;
    try {
      drawerComments = await listTaskComments(task.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load comments';
      toasts.push({ title: 'Comments', description: message, variant: 'error' });
    } finally {
      commentsLoading = false;
    }
  };

  const openSubtaskDrawer = (task: TaskItem) => {
    drawerMode = 'subtask';
    selectedTask = null;
    drawerParent = task;
    drawerComments = [];
    commentsLoading = false;
    drawerOpen = true;
  };

  const closeDrawer = () => {
    if (isSaving || isCommentSubmitting) {
      return;
    }
    drawerOpen = false;
    selectedTask = null;
    drawerParent = null;
    drawerComments = [];
  };

  const refreshTasks = () => {
    void loadTasks();
  };

  const handleDrawerSubmit = async (event: CustomEvent<TaskPayload>) => {
    const payload = event.detail;
    isSaving = true;
    try {
      if (drawerMode === 'edit' && selectedTask) {
        const updated = await updateTask(selectedTask.id, payload);
        toasts.push({ title: 'Task updated', description: 'Changes saved successfully.', variant: 'success' });
        tasks = updateTaskInTree(tasks, updated);
      } else {
        await createTask(payload);
        toasts.push({ title: 'Task created', description: 'Task added to your list.', variant: 'success' });
        await loadTasks(true);
      }
      closeDrawer();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save task';
      toasts.push({ title: 'Save failed', description: message, variant: 'error' });
    } finally {
      isSaving = false;
    }
  };

  const handleDrawerComment = async (event: CustomEvent<string>) => {
    if (!selectedTask) {
      return;
    }
    isCommentSubmitting = true;
    try {
      const comment = await createTaskComment(selectedTask.id, event.detail);
      drawerComments = [comment, ...drawerComments];
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to post comment';
      toasts.push({ title: 'Comment failed', description: message, variant: 'error' });
    } finally {
      isCommentSubmitting = false;
    }
  };

  const changePage = (direction: 1 | -1) => {
    const nextPage = page + direction;
    if (nextPage < 1 || nextPage > pageCount) {
      return;
    }
    page = nextPage;
    void loadTasks();
  };

  const formatStatus = (status: TaskStatus) => status.replace('_', ' ').toLowerCase();
  const formatPriority = (priority: TaskPriority) => priority.toLowerCase();
  const formatDueDate = (value?: string | null) => {
    if (!value) {
      return '-';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return '-';
    }
    return date.toLocaleDateString();
  };

  const isOverdue = (task: TaskItem) => {
    if (!task.dueDate) {
      return false;
    }
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) {
      return false;
    }
    return due < today && task.status !== 'COMPLETED';
  };

  const buildVisibleRows = (items: TaskItem[], depth = 0): { task: TaskItem; depth: number }[] => {
    return items.flatMap((task) => {
      const rows = [{ task, depth }];
      if (task.subtasks?.length && expandedTasks.has(task.id)) {
        rows.push(...buildVisibleRows(task.subtasks, depth + 1));
      }
      return rows;
    });
  };

  $: visibleRows = buildVisibleRows(tasks);
  $: visibleIds = visibleRows.map((r) => r.task.id);
  $: allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  $: someVisibleSelected = visibleIds.some((id) => selectedIds.has(id)) && !allVisibleSelected;

  let headerCheckboxEl: HTMLInputElement | null = null;
  let headerCheckboxElMobile: HTMLInputElement | null = null;
  $: {
    if (headerCheckboxEl) headerCheckboxEl.indeterminate = someVisibleSelected;
    if (headerCheckboxElMobile) headerCheckboxElMobile.indeterminate = someVisibleSelected;
  }

  const toggleSelectAllVisible = (checked: boolean) => {
    const next = new Set(selectedIds);
    if (checked) {
      visibleIds.forEach((id) => next.add(id));
    } else {
      visibleIds.forEach((id) => next.delete(id));
    }
    selectedIds = next;
  };

  // Bulk actions
  const bulkDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    const confirmed = window.confirm(`Delete ${ids.length} selected task(s)? This cannot be undone.`);
    if (!confirmed) return;
    bulkPending = true;
    try {
      const results = await Promise.allSettled(ids.map((id) => deleteTask(id)));
      let success = 0;
      let failed = 0;
      let nextTree = tasks;
      results.forEach((res, index) => {
        if (res.status === 'fulfilled') {
          success += 1;
          nextTree = removeTaskFromTree(nextTree, ids[index]!);
        } else {
          failed += 1;
        }
      });
      tasks = nextTree;
      clearSelection();
      if (success) {
        toasts.push({ title: 'Tasks deleted', description: `${success} deleted`, variant: 'success' });
      }
      if (failed) {
        toasts.push({ title: 'Some deletions failed', description: `${failed} failed`, variant: 'error' });
      }
    } finally {
      bulkPending = false;
    }
  };

  const bulkMarkDone = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    bulkPending = true;
    try {
      const results = await Promise.allSettled(ids.map((id) => updateTask(id, { status: 'COMPLETED' })));
      let success = 0;
      let failed = 0;
      let nextTree = tasks;
      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          success += 1;
          nextTree = updateTaskInTree(nextTree, res.value);
        } else {
          failed += 1;
        }
      });
      tasks = nextTree;
      if (success) {
        toasts.push({ title: 'Tasks updated', description: `${success} marked as done`, variant: 'success' });
      }
      if (failed) {
        toasts.push({ title: 'Some updates failed', description: `${failed} failed`, variant: 'error' });
      }
      clearSelection();
    } finally {
      bulkPending = false;
    }
  };

  const bulkReopen = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    bulkPending = true;
    try {
      const results = await Promise.allSettled(ids.map((id) => updateTask(id, { status: 'TODO' })));
      let success = 0;
      let failed = 0;
      let nextTree = tasks;
      results.forEach((res) => {
        if (res.status === 'fulfilled') {
          success += 1;
          nextTree = updateTaskInTree(nextTree, res.value);
        } else {
          failed += 1;
        }
      });
      tasks = nextTree;
      if (success) {
        toasts.push({ title: 'Tasks reopened', description: `${success} set to TODO`, variant: 'success' });
      }
      if (failed) {
        toasts.push({ title: 'Some updates failed', description: `${failed} failed`, variant: 'error' });
      }
      clearSelection();
    } finally {
      bulkPending = false;
    }
  };
</script>

<div class="space-y-6">
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
  <h2 class="text-2xl font-semibold text-slate-900 dark:text-slate-100">Tasks</h2>
  <p class="text-sm text-slate-600 dark:text-slate-400">Track work, manage subtasks, and collaborate with comments.</p>
    </div>
    <div class="flex flex-wrap items-center gap-3">
  <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
    <input class="cb" type="checkbox" bind:checked={autoSelectSubtasks} />
        Auto-select subtasks
      </label>
      <button
        type="button"
  class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
        on:click={refreshTasks}
        disabled={loading}
      >
        <RefreshCw class="h-4 w-4" />
        Refresh
      </button>
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
        on:click={openCreateDrawer}
      >
        <Plus class="h-4 w-4" />
        New task
      </button>
    </div>
  </div>

  {#if selectedIds.size > 0}
    <div class="flex items-center justify-between rounded-lg border border-indigo-700 bg-indigo-950/40 px-4 py-2 text-sm text-indigo-100">
      <span><strong>{selectedIds.size}</strong> selected</span>
      <div class="flex gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
          on:click={bulkReopen}
          disabled={bulkPending}
        >
          Reopen selected
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-500 hover:text-white disabled:opacity-60"
          on:click={bulkMarkDone}
          disabled={bulkPending}
        >
          Mark selected done
        </button>
        <button
          type="button"
          class="rounded-lg border border-red-500/60 px-3 py-1.5 text-xs text-red-200 transition hover:border-red-400 hover:text-white disabled:opacity-60"
          on:click={bulkDeleteSelected}
          disabled={bulkPending}
        >
          Delete selected
        </button>
      </div>
    </div>
  {/if}

  <form class="space-y-4 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-slate-800 dark:bg-slate-950/60" on:submit|preventDefault={applyFilters}>
    <div class="grid gap-4 md:grid-cols-4">
      <div class="space-y-2">
  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400" for="task-search">Search</label>
        <input
          id="task-search"
          name="search"
          class="w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
          placeholder="Search by title or description"
          bind:value={search}
        />
      </div>
      <div class="space-y-2">
  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400" for="task-due-from">Due from</label>
        <input
          id="task-due-from"
          name="dueFrom"
          type="date"
          class="w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
          bind:value={dueFrom}
        />
      </div>
    <div class="space-y-2">
  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400" for="task-due-to">Due to</label>
        <input
          id="task-due-to"
          name="dueTo"
          type="date"
          class="w-full rounded-lg border px-3 py-2 text-sm border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
          bind:value={dueTo}
        />
      </div>
      <div class="flex items-end gap-2">
        <label class="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
          <input class="cb" type="checkbox" bind:checked={includeSubtasks} />
          Include subtasks in list
        </label>
      </div>
    </div>

    <div class="space-y-3">
      <div>
  <p class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Status</p>
        <div class="mt-2 flex flex-wrap gap-2">
          {#each TASK_STATUS_OPTIONS as option}
            <button
              type="button"
              class={`rounded-full px-3 py-1 text-xs font-medium transition ${
                statusFilter.includes(option)
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              on:click={() => toggleStatus(option)}
            >
              {option.replace('_', ' ').toLowerCase()}
            </button>
          {/each}
        </div>
      </div>

      <div>
  <p class="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">Priority</p>
        <div class="mt-2 flex flex-wrap gap-2">
          {#each TASK_PRIORITY_OPTIONS as option}
            <button
              type="button"
              class={`rounded-full px-3 py-1 text-xs font-medium transition ${
                priorityFilter.includes(option)
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
              on:click={() => togglePriority(option)}
            >
              {option.toLowerCase()}
            </button>
          {/each}
        </div>
      </div>
    </div>

  <div class="flex flex-col gap-2 border-t border-slate-200 pt-3 sm:flex-row sm:justify-end dark:border-slate-800">
      <button
        type="button"
  class="rounded-lg border px-4 py-2 text-sm transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:text-white"
        on:click={resetFilters}
      >
        Reset
      </button>
      <button
        type="submit"
        class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
      >
        Apply filters
      </button>
    </div>
  </form>

  <div class="hidden sm:block overflow-hidden rounded-xl border border-slate-200 bg-white/70 dark:border-slate-800 dark:bg-slate-950/60">
    {#if loading}
  <div class="flex items-center justify-center px-6 py-16 text-sm text-slate-600 dark:text-slate-400">
        Loading tasks...
      </div>
    {:else if error}
      <div class="space-y-3 px-6 py-12 text-center">
  <p class="text-sm text-red-600 dark:text-red-300">{error}</p>
        <button
          type="button"
          class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
          on:click={() => loadTasks()}
        >
          Try again
        </button>
      </div>
    {:else if visibleRows.length === 0}
  <div class="px-6 py-16 text-center text-sm text-slate-600 dark:text-slate-400">
        No tasks match your filters yet. Create one to get started.
      </div>
    {:else}
      <table class="w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
        <thead class="bg-slate-100 text-xs uppercase tracking-wide text-slate-600 dark:bg-slate-950/80 dark:text-slate-400">
          <tr>
            <th class="w-10 px-4 py-3 text-left">
              <input
                class="cb"
                type="checkbox"
                bind:this={headerCheckboxEl}
                checked={allVisibleSelected}
                on:change={(e) => toggleSelectAllVisible((e.target as HTMLInputElement).checked)}
                aria-label="Select all visible"
              />
            </th>
            <th class="px-4 py-3 text-left">Task</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Priority</th>
            <th class="px-4 py-3 text-left">Due</th>
            <th class="px-4 py-3 text-left">Tags</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
  <tbody class="divide-y divide-slate-200 dark:divide-slate-900/80">
          {#each visibleRows as row (row.task.id)}
            <tr class={isOverdue(row.task) ? 'bg-red-500/5' : ''}>
              <td class="px-4 py-3 align-top">
                <input
                  class="cb"
                  type="checkbox"
                  checked={isSelected(row.task.id)}
                  on:change={() => toggleSelect(row.task.id)}
                  disabled={isActionPending(row.task.id) || bulkPending}
                  aria-label={`Select ${row.task.title}`}
                />
              </td>
              <td class="px-4 py-3">
                <div class="flex items-start gap-2">
                  <div style={`margin-left: ${row.depth * 20}px`} class="flex items-center">
                    {#if row.task.subtasks?.length}
                      <button
                        type="button"
                        class="rounded border border-transparent p-1 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
                        on:click={() => toggleTaskExpansion(row.task.id)}
                        aria-label={expandedTasks.has(row.task.id) ? 'Collapse subtasks' : 'Expand subtasks'}
                      >
                        {#if expandedTasks.has(row.task.id)}
                          <ChevronDown class="h-4 w-4" />
                        {:else}
                          <ChevronRight class="h-4 w-4" />
                        {/if}
                      </button>
                    {:else}
                      <span class="inline-block h-4 w-4"></span>
                    {/if}
                  </div>
                  <div class="flex-1">
                    <button
                      type="button"
                      class="text-left text-sm font-semibold text-slate-900 hover:underline dark:text-slate-100"
                      on:click={() => openEditDrawer(row.task)}
                    >
                      {row.task.title}
                    </button>
                    {#if row.task.description}
                      <p class="mt-1 text-xs text-slate-500 line-clamp-2">{row.task.description}</p>
                    {/if}
                  </div>
                </div>
              </td>
              <td class="px-4 py-3">
                <span class={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
                  row.task.status === 'COMPLETED'
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/30'
                    : row.task.status === 'IN_PROGRESS'
                      ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/30'
                      : row.task.status === 'ARCHIVED'
                        ? 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                        : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                }`}>
                  {#if row.task.status === 'COMPLETED'}
                    <Check class="h-3.5 w-3.5" />
                  {/if}
                  {formatStatus(row.task.status)}
                </span>
              </td>
              <td class="px-4 py-3">
                <select
                  class="rounded-lg border px-2 py-1 text-xs border-slate-300 bg-white text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-100"
                  on:change={(event) => handlePriorityChange(row.task, event)}
                  disabled={isActionPending(row.task.id)}
                >
                  {#each TASK_PRIORITY_OPTIONS as option}
                    <option value={option} selected={row.task.priority === option}>{option.toLowerCase()}</option>
                  {/each}
                </select>
              </td>
              <td class={`px-4 py-3 text-sm ${isOverdue(row.task) ? 'text-red-600 dark:text-red-300 font-semibold' : 'text-slate-700 dark:text-slate-200'}`}>
                {formatDueDate(row.task.dueDate)}
              </td>
              <td class="px-4 py-3">
                {#if row.task.tags?.length}
                  <div class="flex flex-wrap gap-1 text-xs">
                    {#each row.task.tags as tag}
                      <span class="rounded-full bg-slate-200 px-2 py-1 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{tag}</span>
                    {/each}
                  </div>
                {:else}
                  <span class="text-xs text-slate-500">-</span>
                {/if}
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex justify-end gap-2">
                  <button
                    type="button"
                    class="rounded-lg border px-3 py-1 text-xs transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-60 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
                    on:click={() => toggleTaskCompleted(row.task)}
                    disabled={isActionPending(row.task.id)}
                  >
                    {row.task.status === 'COMPLETED' ? 'Reopen' : 'Mark done'}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border px-3 py-1 text-xs transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
                    on:click={() => openSubtaskDrawer(row.task)}
                  >
                    Add subtask
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border px-3 py-1 text-xs transition border-red-300 text-red-700 hover:border-red-400 hover:text-red-900 disabled:opacity-60 dark:border-red-500/50 dark:text-red-200 dark:hover:border-red-400 dark:hover:text-white"
                    on:click={() => handleDelete(row.task)}
                    disabled={isActionPending(row.task.id)}
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

  <!-- Mobile: Card list -->
  <div class="sm:hidden">
    <div class="mb-2 flex items-center justify-between rounded-lg border border-slate-200 bg-white/70 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
      <label class="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
        <input
          class="cb"
          type="checkbox"
          bind:this={headerCheckboxElMobile}
          checked={allVisibleSelected}
          on:change={(e) => toggleSelectAllVisible((e.target as HTMLInputElement).checked)}
          aria-label="Select all visible"
        />
        Select all
      </label>
  <span class="text-[11px] text-slate-600 dark:text-slate-400">{visibleRows.length} visible</span>
    </div>

    {#if loading}
  <div class="flex items-center justify-center px-4 py-10 text-sm text-slate-600 dark:text-slate-400">Loading tasks...</div>
    {:else if error}
      <div class="space-y-3 px-4 py-8 text-center">
        <p class="text-sm text-red-600 dark:text-red-300">{error}</p>
        <button
          type="button"
          class="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
          on:click={() => loadTasks()}
        >
          Try again
        </button>
      </div>
    {:else if visibleRows.length === 0}
  <div class="px-4 py-10 text-center text-sm text-slate-600 dark:text-slate-400">No tasks match your filters yet. Create one to get started.</div>
    {:else}
      <ul class="space-y-3">
        {#each visibleRows as row (row.task.id)}
          <li class={`rounded-xl border ${isOverdue(row.task) ? 'bg-red-50 dark:bg-red-500/5' : 'bg-white/70 dark:bg-slate-950/60'} border-slate-200 dark:border-slate-800 p-3`} style={`margin-left: ${row.depth * 8}px`}>
            <div class="flex items-start gap-3">
              <input
                class="cb"
                type="checkbox"
                checked={isSelected(row.task.id)}
                on:change={() => toggleSelect(row.task.id)}
                disabled={isActionPending(row.task.id) || bulkPending}
                aria-label={`Select ${row.task.title}`}
              />

<!-- checkbox styles are now global in app.css (.cb) -->
              <div class="min-w-0 flex-1">
                <div class="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    class="max-w-[75%] truncate text-left text-[15px] font-semibold text-slate-900 hover:underline dark:text-slate-100"
                    on:click={() => openEditDrawer(row.task)}
                    title={row.task.title}
                  >
                    {row.task.title}
                  </button>
                  {#if row.task.subtasks?.length}
                    <button
                      type="button"
                      class="rounded border border-transparent p-1 text-slate-500 transition hover:border-slate-300 hover:text-slate-700 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
                      on:click={() => toggleTaskExpansion(row.task.id)}
                      aria-label={expandedTasks.has(row.task.id) ? 'Collapse subtasks' : 'Expand subtasks'}
                    >
                      {#if expandedTasks.has(row.task.id)}
                        <ChevronDown class="h-4 w-4" />
                      {:else}
                        <ChevronRight class="h-4 w-4" />
                      {/if}
                    </button>
                  {/if}
                </div>
                {#if row.task.description}
                  <p class="mt-1 line-clamp-2 text-[12px] text-slate-600 dark:text-slate-500">{row.task.description}</p>
                {/if}
                <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <span class={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium ${
                    row.task.status === 'COMPLETED'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/30'
                      : row.task.status === 'IN_PROGRESS'
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/30'
                        : row.task.status === 'ARCHIVED'
                          ? 'bg-slate-50 text-slate-600 border border-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600'
                          : 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                  }`}>
                    {formatStatus(row.task.status)}
                  </span>
                  <span class="rounded-full bg-slate-800 px-2 py-0.5 text-slate-300">{formatPriority(row.task.priority)}</span>
                  <span class={`ml-auto ${isOverdue(row.task) ? 'text-red-600 dark:text-red-300 font-semibold' : 'text-slate-700 dark:text-slate-300'}`}>{formatDueDate(row.task.dueDate)}</span>
                </div>
                <div class="mt-2">
                  {#if row.task.tags?.length}
                    <div class="flex flex-wrap gap-1 text-[11px]">
                      {#each row.task.tags as tag}
                        <span class="rounded-full bg-slate-200 px-2 py-0.5 text-slate-700 dark:bg-slate-800 dark:text-slate-300">{tag}</span>
                      {/each}
                    </div>
                  {:else}
                    <span class="text-[11px] text-slate-500">No tags</span>
                  {/if}
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="rounded-lg border px-2.5 py-1 text-[11px] transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 disabled:opacity-60 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
                    on:click={() => toggleTaskCompleted(row.task)}
                    disabled={isActionPending(row.task.id)}
                  >
                    {row.task.status === 'COMPLETED' ? 'Reopen' : 'Mark done'}
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border px-2.5 py-1 text-[11px] transition border-slate-300 text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:border-slate-800 dark:text-slate-200 dark:hover:border-slate-600 dark:hover:text-white"
                    on:click={() => openSubtaskDrawer(row.task)}
                  >
                    Add subtask
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border px-2.5 py-1 text-[11px] transition border-red-300 text-red-700 hover:border-red-400 hover:text-red-900 disabled:opacity-60 dark:border-red-500/50 dark:text-red-200 dark:hover:border-red-400 dark:hover:text-white"
                    on:click={() => handleDelete(row.task)}
                    disabled={isActionPending(row.task.id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if !loading && pageCount > 1}
    <div class="flex items-center justify-between text-sm text-slate-300">
      <span>Showing page {page} of {pageCount} � {total} tasks</span>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          on:click={() => changePage(-1)}
          disabled={page === 1}
        >
          Previous
        </button>
        <button
          type="button"
          class="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-200 transition hover:border-slate-600 hover:text-white disabled:opacity-50"
          on:click={() => changePage(1)}
          disabled={page === pageCount}
        >
          Next
        </button>
      </div>
    </div>
  {/if}
</div>

<TaskDrawer
  open={drawerOpen}
  mode={drawerMode}
  task={selectedTask}
  parentTask={drawerParent}
  comments={drawerComments}
  commentsLoading={commentsLoading}
  isSaving={isSaving}
  isCommentSubmitting={isCommentSubmitting}
  on:close={closeDrawer}
  on:submit={handleDrawerSubmit}
  on:comment={handleDrawerComment}
/>
