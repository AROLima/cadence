import { apiFetch } from '$lib/utils/api';
import type {
  PaginatedTaskResult,
  TaskComment,
  TaskItem,
  TaskPriority,
  TaskStatus,
} from '$lib/types/tasks';

export interface TaskFilters {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  dueFrom?: string | null;
  dueTo?: string | null;
  q?: string;
  includeSubtasks?: boolean;
  tags?: string[];
  tag?: string;
}

export interface PaginationInput {
  page?: number;
  pageSize?: number;
}

export interface TaskPayload {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  repeatRRule?: string | null;
  tagNames?: string[];
  parentId?: number | null;
}

interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: unknown;
  message?: string | string[];
}

function extractErrorMessage(defaultMessage: string, payload?: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return defaultMessage;
  }
  const value = (payload as { message?: unknown }).message;
  if (!value) {
    return defaultMessage;
  }
  if (Array.isArray(value) && value.length > 0) {
    return String(value[0]);
  }
  return String(value);
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<{
  data: T;
  meta?: unknown;
}> {
  let payload: ApiResponse<T> | undefined;

  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch (error) {
    if (!response.ok) {
      throw new Error(fallbackMessage);
    }
    throw error;
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(fallbackMessage, payload));
  }

  if (!payload?.success) {
    throw new Error(extractErrorMessage(fallbackMessage, payload));
  }

  return { data: payload.data, meta: payload.meta };
}

function buildQueryString(filters: TaskFilters = {}, pagination: PaginationInput = {}): string {
  const search = new URLSearchParams();

  if (pagination.page && pagination.page > 0) {
    search.set('page', pagination.page.toString());
  }
  if (pagination.pageSize && pagination.pageSize > 0) {
    search.set('pageSize', pagination.pageSize.toString());
  }

  filters.status?.forEach((status) => search.append('status', status));
  filters.priority?.forEach((priority) => search.append('priority', priority));

  if (filters.dueFrom) {
    search.set('dueFrom', filters.dueFrom);
  }
  if (filters.dueTo) {
    search.set('dueTo', filters.dueTo);
  }
  if (filters.q) {
    search.set('q', filters.q);
  }
  if (filters.tag) {
    search.set('tag', filters.tag);
  }
  filters.tags?.forEach((tag) => search.append('tags', tag));

  if (filters.includeSubtasks !== undefined) {
    search.set('includeSubtasks', String(filters.includeSubtasks));
  }

  const query = search.toString();
  return query.length ? `?${query}` : '';
}

export async function listTasks(filters: TaskFilters = {}, pagination: PaginationInput = {}): Promise<PaginatedTaskResult> {
  const query = buildQueryString(filters, pagination);
  const response = await apiFetch(`/tasks${query}`);
  const { data, meta } = await parseApiResponse<PaginatedTaskResult>(response, 'Failed to fetch tasks');
  const payloadMeta = (meta ?? data.meta ?? {}) as PaginatedTaskResult['meta'];
  const fallbackPage = pagination.page ?? 1;
  const fallbackSize = pagination.pageSize ?? (data.items?.length ?? 0);
  const resolvedPageSize = (payloadMeta.pageSize as number | undefined) ?? fallbackSize ?? 0;
  const pageSizeValue = resolvedPageSize > 0 ? resolvedPageSize : 1;
  const totalItems = (payloadMeta.total as number | undefined) ?? data.items?.length ?? 0;
  const safeMeta: PaginatedTaskResult['meta'] = {
    ...payloadMeta,
    page: (payloadMeta.page as number | undefined) ?? fallbackPage,
    pageSize: pageSizeValue,
    total: totalItems,
    pageCount:
      (payloadMeta.pageCount as number | undefined) ?? Math.max(1, Math.ceil(totalItems / pageSizeValue)),
  };

  return {
    items: data.items ?? [],
    meta: safeMeta,
  };
}

export async function getTaskById(id: number): Promise<TaskItem> {
  const response = await apiFetch(`/tasks/${id}`);
  const { data } = await parseApiResponse<TaskItem>(response, 'Failed to load task');
  return data;
}

export async function createTask(payload: TaskPayload): Promise<TaskItem> {
  const response = await apiFetch('/tasks', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const { data } = await parseApiResponse<TaskItem>(response, 'Failed to create task');
  return data;
}

export async function updateTask(id: number, payload: Partial<TaskPayload>): Promise<TaskItem> {
  const response = await apiFetch(`/tasks/${id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const { data } = await parseApiResponse<TaskItem>(response, 'Failed to update task');
  return data;
}

export async function deleteTask(id: number): Promise<void> {
  const response = await apiFetch(`/tasks/${id}`, { method: 'DELETE' });
  await parseApiResponse<{ message?: string }>(response, 'Failed to delete task');
}

export async function listTaskComments(id: number): Promise<TaskComment[]> {
  const response = await apiFetch(`/tasks/${id}/comments`);
  const { data } = await parseApiResponse<TaskComment[]>(response, 'Failed to load comments');
  return data ?? [];
}

export async function createTaskComment(id: number, text: string): Promise<TaskComment> {
  const response = await apiFetch(`/tasks/${id}/comments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  const { data } = await parseApiResponse<TaskComment>(response, 'Failed to add comment');
  return data;
}

export async function createSubtask(parentId: number, payload: TaskPayload): Promise<TaskItem> {
  const response = await apiFetch(`/tasks/${parentId}/subtasks`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const { data } = await parseApiResponse<TaskItem>(response, 'Failed to create subtask');
  return data;
}


