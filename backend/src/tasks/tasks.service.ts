import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, TaskPriority, TaskStatus } from '@prisma/client';
import { PaginationMeta, PaginationParams } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskCommentView, TaskView } from './types/task-view.type';
import { TaskRecurrenceService } from './task-recurrence.service';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly recurrence: TaskRecurrenceService,
  ) {}

  async listTasks(
    userId: number,
    pagination: PaginationParams,
    filters: TaskQueryDto,
  ) {
    const where: Prisma.TaskWhereInput = {
      userId,
    };

    if (!filters.includeSubtasks) {
      where.parentId = null;
    }

    const andConditions: Prisma.TaskWhereInput[] = [];

    if (filters.status?.length) {
      andConditions.push({ status: { in: filters.status } });
    }

    if (filters.priority?.length) {
      andConditions.push({ priority: { in: filters.priority } });
    }

    if (filters.dueFrom || filters.dueTo) {
      const dueDate: Prisma.DateTimeFilter = {};
      if (filters.dueFrom) {
        dueDate.gte = new Date(filters.dueFrom);
      }
      if (filters.dueTo) {
        dueDate.lte = new Date(filters.dueTo);
      }
      andConditions.push({ dueDate });
    }

    const normalizedTagFilters = this.normalizeTags([
      ...(filters.tags ?? []),
      ...(filters.tag ? [filters.tag] : []),
    ]);

    if (normalizedTagFilters.length) {
      andConditions.push({
        tags: {
          some: {
            userId,
            name: { in: normalizedTagFilters },
          },
        },
      });
    }

    if (filters.q?.trim()) {
      const query = filters.q.trim();
      andConditions.push({
        OR: [
          { title: { contains: query, mode: 'insensitive' } },
          { description: { contains: query, mode: 'insensitive' } },
        ],
      });
    }

    if (andConditions.length) {
      where.AND = andConditions;
    }

    const tasksResult = await this.prisma.task.findMany({
      where,
      skip: pagination.skip,
      take: pagination.take,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
      include: this.buildTaskInclude(),
    });
    const total = await this.prisma.task.count({ where });

    const baseItems = tasksResult.map((task) => this.toTaskView(task));
    const expanded = baseItems.flatMap((task) => this.recurrence.expand(task));

    const meta: PaginationMeta = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };

    return { items: expanded, meta };
  }

  async getTaskById(userId: number, id: number): Promise<TaskView> {
    const task = await this.prisma.task.findFirst({
      where: { id, userId },
      include: this.buildTaskInclude(true),
    });

    if (!task) {
      throw new NotFoundException('Task not found');
    }

    return this.toTaskView(task, true);
  }

  async createTask(userId: number, dto: CreateTaskDto): Promise<TaskView> {
    await this.ensureParentOwnership(userId, dto.parentId);

    const normalizedTags = this.normalizeTags(dto.tagNames);
    const data: Prisma.TaskCreateInput = {
      title: dto.title,
      description: dto.description,
      status: dto.status ?? TaskStatus.TODO,
      priority: dto.priority ?? TaskPriority.MEDIUM,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      repeatRRule: dto.repeatRRule,
      user: { connect: { id: userId } },
      parent: dto.parentId ? { connect: { id: dto.parentId } } : undefined,
      tags: normalizedTags.length
        ? {
            connectOrCreate: normalizedTags.map((name) => ({
              where: { userId_name: { userId, name } },
              create: { name, user: { connect: { id: userId } } },
            })),
          }
        : undefined,
    };

    const task = await this.prisma.task.create({
      data,
      include: this.buildTaskInclude(),
    });

    return this.toTaskView(task);
  }

  async updateTask(
    userId: number,
    id: number,
    dto: UpdateTaskDto,
  ): Promise<TaskView> {
    await this.ensureTaskOwnership(userId, id);
    await this.ensureParentOwnership(userId, dto.parentId);

    const normalizedTags = dto.tagNames
      ? this.normalizeTags(dto.tagNames)
      : undefined;

    const task = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        status: dto.status,
        priority: dto.priority,
        dueDate:
          dto.dueDate === undefined
            ? undefined
            : dto.dueDate
              ? new Date(dto.dueDate)
              : null,
        repeatRRule: dto.repeatRRule,
        parent:
          dto.parentId === undefined
            ? undefined
            : dto.parentId === null
              ? { disconnect: true }
              : { connect: { id: dto.parentId } },
        tags:
          normalizedTags === undefined
            ? undefined
            : {
                set: [],
                connectOrCreate: normalizedTags.map((name) => ({
                  where: { userId_name: { userId, name } },
                  create: { name, user: { connect: { id: userId } } },
                })),
              },
      },
      include: this.buildTaskInclude(),
    });

    return this.toTaskView(task);
  }

  async deleteTask(userId: number, id: number): Promise<void> {
    await this.ensureTaskOwnership(userId, id);
    await this.prisma.task.delete({ where: { id } });
  }

  async createComment(
    userId: number,
    taskId: number,
    dto: CreateCommentDto,
  ): Promise<TaskCommentView> {
    await this.ensureTaskOwnership(userId, taskId);

    const comment = await this.prisma.taskComment.create({
      data: {
        task: { connect: { id: taskId } },
        author: { connect: { id: userId } },
        text: dto.text,
      },
    });

    return {
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      authorId: comment.userId,
    };
  }

  async listComments(
    userId: number,
    taskId: number,
  ): Promise<TaskCommentView[]> {
    await this.ensureTaskOwnership(userId, taskId);

    const comments = await this.prisma.taskComment.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });

    return comments.map((comment) => ({
      id: comment.id,
      text: comment.text,
      createdAt: comment.createdAt,
      authorId: comment.userId,
    }));
  }

  async createSubtask(
    userId: number,
    taskId: number,
    dto: CreateTaskDto,
  ): Promise<TaskView> {
    await this.ensureTaskOwnership(userId, taskId);
    return this.createTask(userId, { ...dto, parentId: taskId });
  }

  async addTagToTask(
    userId: number,
    taskId: number,
    tagId: number,
  ): Promise<TaskView> {
    await this.ensureTaskOwnership(userId, taskId);
    await this.ensureTagOwnership(userId, tagId);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        tags: {
          connect: { id: tagId },
        },
      },
      include: this.buildTaskInclude(),
    });

    return this.toTaskView(task);
  }

  async removeTagFromTask(
    userId: number,
    taskId: number,
    tagId: number,
  ): Promise<TaskView> {
    await this.ensureTaskOwnership(userId, taskId);
    await this.ensureTagOwnership(userId, tagId);

    const task = await this.prisma.task.update({
      where: { id: taskId },
      data: {
        tags: {
          disconnect: { id: tagId },
        },
      },
      include: this.buildTaskInclude(),
    });

    return this.toTaskView(task);
  }

  private buildTaskInclude(includeComments = false): Prisma.TaskInclude {
    return {
      tags: true,
      subtasks: {
        include: { tags: true },
        orderBy: { dueDate: 'asc' },
      },
      ...(includeComments
        ? {
            comments: {
              include: { author: true },
              orderBy: { createdAt: 'desc' },
            },
          }
        : {}),
    };
  }

  /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
  private toTaskView(task: any, includeComments = false): TaskView {
    const tags = (task.tags ?? []).map((tag: { name: string }) => tag.name);
    const mappedSubtasks = (task.subtasks ?? []).map((subtask: any) =>
      this.toTaskView({ ...subtask, comments: undefined }, false),
    );
    const mappedComments = includeComments
      ? (task.comments ?? []).map((comment: any) => ({
          id: comment.id,
          text: comment.text,
          createdAt: comment.createdAt,
          authorId: comment.userId,
        }))
      : undefined;

    return {
      id: task.id,
      userId: task.userId,
      parentId: task.parentId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      repeatRRule: task.repeatRRule,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      tags,
      subtasks: mappedSubtasks,
      comments: mappedComments,
    };
  }
  /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */

  private normalizeTags(tagNames?: string[] | null): string[] {
    if (!tagNames?.length) {
      return [];
    }

    return Array.from(
      new Set(
        tagNames
          .map((tag) => tag.trim().toLowerCase())
          .filter((tag) => tag.length > 0),
      ),
    );
  }

  private async ensureTaskOwnership(
    userId: number,
    taskId?: number,
  ): Promise<void> {
    if (!taskId) {
      return;
    }

    const task = await this.prisma.task.findFirst({
      where: { id: taskId, userId },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }
  }

  private async ensureParentOwnership(
    userId: number,
    parentId?: number | null,
  ): Promise<void> {
    if (!parentId) {
      return;
    }

    await this.ensureTaskOwnership(userId, parentId);
  }

  private async ensureTagOwnership(userId: number, tagId: number) {
    const tag = await this.prisma.taskTag.findFirst({
      where: { id: tagId, userId },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }
  }
}
