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

  const markTaskCompleted = (task: TaskItem) => {
    if (task.status === 'COMPLETED') {
      return;
    }
    void handleQuickUpdate(task, { status: 'COMPLETED' });
  };

  const handlePriorityChange = (task: TaskItem, event: Event) => {
    const select = event.target as HTMLSelectElement;
    const nextPriority = select.value as TaskPriority;
    if (nextPriority === task.priority) {
      return;
    }
    void handleQuickUpdate(task, { priority: nextPriority });
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
</script>

<div class="space-y-6">
  <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2 class="text-2xl font-semibold text-slate-100">Tasks</h2>
      <p class="text-sm text-slate-400">Track work, manage subtasks, and collaborate with comments.</p>
    </div>
    <div class="flex gap-2">
      <button
        type="button"
        class="flex items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:border-slate-600 hover:text-white"
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

  <form class="space-y-4 rounded-xl border border-slate-800 bg-slate-950/60 p-4" on:submit|preventDefault={applyFilters}>
    <div class="grid gap-4 md:grid-cols-4">
      <div class="space-y-2">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-400" for="task-search">Search</label>
        <input
          id="task-search"
          name="search"
          class="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          placeholder="Search by title or description"
          bind:value={search}
        />
      </div>
      <div class="space-y-2">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-400" for="task-due-from">Due from</label>
        <input
          id="task-due-from"
          name="dueFrom"
          type="date"
          class="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          bind:value={dueFrom}
        />
      </div>
      <div class="space-y-2">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-400" for="task-due-to">Due to</label>
        <input
          id="task-due-to"
          name="dueTo"
          type="date"
          class="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
          bind:value={dueTo}
        />
      </div>
      <div class="flex items-end gap-2">
        <label class="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" bind:checked={includeSubtasks} />
          Include subtasks in list
        </label>
      </div>
    </div>

    <div class="space-y-3">
      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</p>
        <div class="mt-2 flex flex-wrap gap-2">
          {#each TASK_STATUS_OPTIONS as option}
            <button
              type="button"
              class={`rounded-full px-3 py-1 text-xs font-medium transition ${
                statusFilter.includes(option)
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
              }`}
              on:click={() => toggleStatus(option)}
            >
              {option.replace('_', ' ').toLowerCase()}
            </button>
          {/each}
        </div>
      </div>

      <div>
        <p class="text-xs font-semibold uppercase tracking-wide text-slate-400">Priority</p>
        <div class="mt-2 flex flex-wrap gap-2">
          {#each TASK_PRIORITY_OPTIONS as option}
            <button
              type="button"
              class={`rounded-full px-3 py-1 text-xs font-medium transition ${
                priorityFilter.includes(option)
                  ? 'bg-amber-500 text-slate-900'
                  : 'bg-slate-900/80 text-slate-300 hover:bg-slate-800'
              }`}
              on:click={() => togglePriority(option)}
            >
              {option.toLowerCase()}
            </button>
          {/each}
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2 border-t border-slate-800 pt-3 sm:flex-row sm:justify-end">
      <button
        type="button"
        class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
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

  <div class="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
    {#if loading}
      <div class="flex items-center justify-center px-6 py-16 text-sm text-slate-400">
        Loading tasks...
      </div>
    {:else if error}
      <div class="space-y-3 px-6 py-12 text-center">
        <p class="text-sm text-red-300">{error}</p>
        <button
          type="button"
          class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
          on:click={() => loadTasks()}
        >
          Try again
        </button>
      </div>
    {:else if visibleRows.length === 0}
      <div class="px-6 py-16 text-center text-sm text-slate-400">
        No tasks match your filters yet. Create one to get started.
      </div>
    {:else}
      <table class="w-full divide-y divide-slate-800 text-sm">
        <thead class="bg-slate-950/80 text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th class="px-4 py-3 text-left">Task</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Priority</th>
            <th class="px-4 py-3 text-left">Due</th>
            <th class="px-4 py-3 text-left">Tags</th>
            <th class="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-900/80">
          {#each visibleRows as row (row.task.id)}
            <tr class={isOverdue(row.task) ? 'bg-red-500/5' : ''}>
              <td class="px-4 py-3">
                <div class="flex items-start gap-2">
                  <div style={`margin-left: ${row.depth * 20}px`} class="flex items-center">
                    {#if row.task.subtasks?.length}
                      <button
                        type="button"
                        class="rounded border border-transparent p-1 text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
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
                      class="text-left text-sm font-semibold text-slate-100 hover:underline"
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
                    ? 'bg-emerald-500/20 text-emerald-200'
                    : row.task.status === 'IN_PROGRESS'
                      ? 'bg-indigo-500/20 text-indigo-200'
                      : row.task.status === 'ARCHIVED'
                        ? 'bg-slate-700 text-slate-200'
                        : 'bg-slate-800 text-slate-200'
                }`}>
                  {#if row.task.status === 'COMPLETED'}
                    <Check class="h-3.5 w-3.5" />
                  {/if}
                  {formatStatus(row.task.status)}
                </span>
              </td>
              <td class="px-4 py-3">
                <select
                  class="rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-xs text-slate-100 focus:border-indigo-500 focus:outline-none"
                  on:change={(event) => handlePriorityChange(row.task, event)}
                  disabled={isActionPending(row.task.id)}
                >
                  {#each TASK_PRIORITY_OPTIONS as option}
                    <option value={option} selected={row.task.priority === option}>{option.toLowerCase()}</option>
                  {/each}
                </select>
              </td>
              <td class={`px-4 py-3 text-sm ${isOverdue(row.task) ? 'text-red-300 font-semibold' : 'text-slate-200'}`}>
                {formatDueDate(row.task.dueDate)}
              </td>
              <td class="px-4 py-3">
                {#if row.task.tags?.length}
                  <div class="flex flex-wrap gap-1 text-xs">
                    {#each row.task.tags as tag}
                      <span class="rounded-full bg-slate-800 px-2 py-1 text-slate-300">{tag}</span>
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
                    class="rounded-lg border border-slate-800 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-600 hover:text-white disabled:opacity-60"
                    on:click={() => markTaskCompleted(row.task)}
                    disabled={row.task.status === 'COMPLETED' || isActionPending(row.task.id)}
                  >
                    Mark done
                  </button>
                  <button
                    type="button"
                    class="rounded-lg border border-slate-800 px-3 py-1 text-xs text-slate-200 transition hover:border-slate-600 hover:text-white"
                    on:click={() => openSubtaskDrawer(row.task)}
                  >
                    Add subtask
                  </button>
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
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
