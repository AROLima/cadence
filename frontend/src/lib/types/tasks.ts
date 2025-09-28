export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'COMPLETED' | 'ARCHIVED';

export const TASK_STATUS_OPTIONS: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED'];

export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export const TASK_PRIORITY_OPTIONS: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export interface TaskComment {
  id: number;
  text: string;
  authorId: number;
  createdAt: string;
}

export interface TaskItem {
  id: number;
  userId: number;
  parentId: number | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  repeatRRule?: string | null;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  subtasks?: TaskItem[];
  comments?: TaskComment[];
}

export interface PaginatedTaskResult {
  items: TaskItem[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    pageCount: number;
    [key: string]: unknown;
  };
}
export type TaskDrawerMode = 'create' | 'edit' | 'subtask';
