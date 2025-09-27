import { TaskPriority, TaskStatus } from '@prisma/client';

export interface TaskCommentView {
  id: number;
  text: string;
  createdAt: Date;
  authorId: number;
}

export interface TaskView {
  id: number;
  userId: number;
  parentId: number | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: Date | null;
  repeatRRule?: string | null;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  subtasks: TaskView[];
  comments?: TaskCommentView[];
}
