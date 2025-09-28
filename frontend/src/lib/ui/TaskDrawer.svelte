<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    TASK_PRIORITY_OPTIONS,
    TASK_STATUS_OPTIONS,
    type TaskComment,
    type TaskItem,
    type TaskPriority,
    type TaskStatus,
    type TaskDrawerMode,
  } from '$lib/types/tasks';


  export let open = false;
  export let mode: TaskDrawerMode = 'create';
  export let task: TaskItem | null = null;
  export let parentTask: TaskItem | null = null;
  export let comments: TaskComment[] = [];
  export let commentsLoading = false;
  export let isSaving = false;
  export let isCommentSubmitting = false;

  type TaskFormState = {
    title: string;
    description: string;
    status: TaskStatus;
    priority: TaskPriority;
    dueDate: string | null;
    repeatRRule: string | null;
    tagNames: string[];
    parentId: number | null;
  };

  const dispatch = createEventDispatcher<{
    close: void;
    submit: TaskFormState;
    comment: string;
  }>();

  let title = '';
  let description = '';
  let status: TaskStatus = 'TODO';
  let priority: TaskPriority = 'MEDIUM';
  let dueDate: string | null = null;
  let repeatRRule = '';
  let tagsInput = '';
  let parentId: number | null = null;
  let activeTab: 'details' | 'comments' = 'details';
  let commentText = '';

  let initializedKey: string | null = null;

  const resolveInitKey = () => {
    if (!open) return null;
    if (mode === 'edit' && task) {
      return `edit-${task.id}`;
    }
    if (mode === 'subtask' && parentTask) {
      return `subtask-${parentTask.id}`;
    }
    return 'create';
  };

  const resetForm = () => {
    title = '';
    description = '';
    status = 'TODO';
    priority = 'MEDIUM';
    dueDate = null;
    repeatRRule = '';
    tagsInput = '';
    parentId = parentTask?.id ?? null;
    activeTab = 'details';
    commentText = '';
  };

  const hydrateFromTask = (source: TaskItem) => {
    title = source.title ?? '';
    description = source.description ?? '';
    status = source.status;
    priority = source.priority;
    dueDate = source.dueDate ? source.dueDate.slice(0, 10) : null;
    repeatRRule = source.repeatRRule ?? '';
    tagsInput = source.tags?.join(', ') ?? '';
    parentId = source.parentId ?? null;
    activeTab = 'details';
    commentText = '';
  };

  $: currentKey = resolveInitKey();
  $: if (open) {
    if (currentKey !== initializedKey) {
      if (mode === 'edit' && task) {
        hydrateFromTask(task);
      } else {
        resetForm();
      }
      initializedKey = currentKey;
    }
  } else if (initializedKey !== null) {
    initializedKey = null;
  }

  $: if (mode !== 'edit' && activeTab === 'comments') {
    activeTab = 'details';
  }

  const closeDrawer = () => {
    if (isSaving) return;
    dispatch('close');
  };

  const handleSubmit = () => {
    if (!title.trim()) {
      return;
    }

    const payload: TaskFormState = {
      title: title.trim(),
      description: description?.trim() ?? '',
      status,
      priority,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00`).toISOString() : null,
      repeatRRule: repeatRRule?.trim() ? repeatRRule.trim() : null,
      tagNames: tagsInput
        .split(',')
        .map((tag) => tag.trim())
        .filter((tag) => tag.length > 0),
      parentId,
    };

    dispatch('submit', payload);
  };

  const handleCommentSubmit = (event: Event) => {
    event.preventDefault();
    const value = commentText.trim();
    if (!value) {
      return;
    }
    dispatch('comment', value);
    commentText = '';
  };

  const heading = () => {
    if (mode === 'edit') {
      return 'Edit Task';
    }
    if (mode === 'subtask') {
      return parentTask?.title ? `Add Subtask for "${parentTask.title}"` : 'Add Subtask';
    }
    return 'Create Task';
  };
</script>

{#if open}
  <div class="fixed inset-0 z-[100] flex justify-end bg-slate-950/60 backdrop-blur-sm">
    <button
      type="button"
      class="absolute inset-0 cursor-default"
      aria-label="Close task drawer"
      on:click={closeDrawer}
    ></button>

    <div
      class="relative z-[101] flex h-full w-full max-w-3xl flex-col border-l border-slate-800 bg-slate-950/95 text-slate-100 shadow-2xl shadow-slate-900/80"
    >
      <div class="flex items-start justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h2 class="text-xl font-semibold">{heading()}</h2>
          {#if mode === 'edit' && task?.title}
            <p class="text-xs text-slate-500">Last updated {new Date(task.updatedAt).toLocaleString()}</p>
          {/if}
        </div>
        <button
          type="button"
          class="rounded-lg border border-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:border-slate-600 hover:text-white"
          on:click={closeDrawer}
        >
          Close
        </button>
      </div>

      <div class="flex flex-col overflow-hidden">
        <div class="flex border-b border-slate-800">
          <button
            type="button"
            class={`flex-1 px-4 py-2 text-sm font-medium transition ${
              activeTab === 'details' ? 'border-b-2 border-indigo-500 text-indigo-200' : 'text-slate-400 hover:text-slate-200'
            }`}
            on:click={() => (activeTab = 'details')}
          >
            Details
          </button>
          <button
            type="button"
            class={`flex-1 px-4 py-2 text-sm font-medium transition ${
              activeTab === 'comments'
                ? 'border-b-2 border-indigo-500 text-indigo-200'
                : mode === 'edit'
                  ? 'text-slate-400 hover:text-slate-200'
                  : 'cursor-not-allowed text-slate-600'
            }`}
            on:click={() => {
              if (mode === 'edit') {
                activeTab = 'comments';
              }
            }}
            disabled={mode !== 'edit'}
          >
            Comments
          </button>
        </div>

        {#if activeTab === 'details'}
          <form class="flex flex-1 flex-col gap-6 overflow-y-auto px-6 py-6" on:submit|preventDefault={handleSubmit}>
            <div class="space-y-2">
              <label class="text-sm font-medium" for="task-title">Title *</label>
              <input
                id="task-title"
                class="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                placeholder="Write a concise title"
                bind:value={title}
                required
              />
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium" for="task-description">Description</label>
              <textarea
                id="task-description"
                class="min-h-[120px] w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                placeholder="Add more context for this task"
                bind:value={description}
              ></textarea>
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <div class="space-y-2">
                <label class="text-sm font-medium" for="task-status">Status</label>
                <select
                  id="task-status"
                  class="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  bind:value={status}
                >
                  {#each TASK_STATUS_OPTIONS as option}
                    <option value={option}>{option.replace('_', ' ')}</option>
                  {/each}
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium" for="task-priority">Priority</label>
                <select
                  id="task-priority"
                  class="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  bind:value={priority}
                >
                  {#each TASK_PRIORITY_OPTIONS as option}
                    <option value={option}>{option.toLowerCase()}</option>
                  {/each}
                </select>
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium" for="task-due">Due date</label>
                <input
                  id="task-due"
                  type="date"
                  class="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  bind:value={dueDate}
                />
              </div>

              <div class="space-y-2">
                <label class="text-sm font-medium" for="task-rrule">Recurrence (RRULE)</label>
                <input
                  id="task-rrule"
                  class="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                  placeholder="e.g. FREQ=WEEKLY;COUNT=5"
                  bind:value={repeatRRule}
                />
              </div>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-medium" for="task-tags">Tags</label>
              <input
                id="task-tags"
                class="w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                placeholder="Comma separated tags"
                bind:value={tagsInput}
              />
              <p class="text-xs text-slate-500">Tags help with filtering — example: finance, reporting.</p>
            </div>

            {#if parentId}
              <div class="rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
                This task will be created as a subtask.
              </div>
            {/if}

            <div class="flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row sm:justify-end">
              <button
                type="button"
                class="rounded-lg border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500 hover:text-white"
                on:click={closeDrawer}
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : mode === 'edit' ? 'Save changes' : 'Create task'}
              </button>
            </div>
          </form>
        {:else}
          <div class="flex flex-1 flex-col overflow-hidden">
            <div class="flex-1 space-y-4 overflow-y-auto px-6 py-6">
              {#if commentsLoading}
                <p class="text-sm text-slate-500">Loading comments...</p>
              {:else if comments.length === 0}
                <p class="text-sm text-slate-500">No comments yet. Start the conversation below.</p>
              {:else}
                <ul class="space-y-4">
                  {#each comments as comment}
                    <li class="rounded-lg border border-slate-800 bg-slate-900/80 px-4 py-3">
                      <p class="text-sm text-slate-100">{comment.text}</p>
                      <p class="mt-2 text-xs text-slate-500">Posted {new Date(comment.createdAt).toLocaleString()}</p>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
            <form class="border-t border-slate-800 px-6 py-4" on:submit={handleCommentSubmit}>
              <label class="text-sm font-medium" for="task-comment">Add a comment</label>
              <textarea
                id="task-comment"
                class="mt-2 min-h-[100px] w-full rounded-lg border border-slate-800 bg-slate-900/80 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
                placeholder="Share progress or next steps..."
                bind:value={commentText}
              ></textarea>
              <div class="mt-3 flex justify-end">
                <button
                  type="submit"
                  class="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:cursor-not-allowed disabled:opacity-70"
                  disabled={isCommentSubmitting}
                >
                  {isCommentSubmitting ? 'Posting...' : 'Post comment'}
                </button>
              </div>
            </form>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

