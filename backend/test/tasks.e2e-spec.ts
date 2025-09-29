import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { Request } from 'express';
import { TaskPriority, TaskStatus } from '@prisma/client';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { PaginationParams } from '../src/common/dto/pagination.dto';
import { TasksController } from '../src/tasks/tasks.controller';
import { TasksService } from '../src/tasks/tasks.service';
import { TaskView } from '../src/tasks/types/task-view.type';

type TasksListResponse = {
  items: TaskView[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
};

describe('TasksController (e2e)', () => {
  let app: INestApplication;

  const task: TaskView = {
    id: 1,
    userId: 1,
    parentId: null,
    title: 'First task',
    description: 'Demo',
    status: TaskStatus.TODO,
    priority: TaskPriority.MEDIUM,
    dueDate: null,
    repeatRRule: null,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    updatedAt: new Date('2025-01-01T00:00:00.000Z'),
    tags: ['demo'],
    subtasks: [],
  };

  const mockTasksService: Partial<TasksService> = {
    listTasks: jest.fn((userId: number, pagination: PaginationParams) =>
      Promise.resolve({
        items: [task],
        meta: {
          page: pagination.page,
          pageSize: pagination.pageSize,
          total: 1,
          pageCount: 1,
        },
      }),
    ),
    createTask: jest.fn(() => Promise.resolve(task)),
  };

  const mockGuard: CanActivate = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<Request>() as Request & {
        user?: { id: number };
      };
      req.user = { id: 1 };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        {
          provide: TasksService,
          useValue: mockTasksService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue(mockGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('GET /tasks returns list with pagination metadata', async () => {
    const httpServer = app.getHttpServer();
    const response = await request(httpServer).get('/tasks').expect(200);
    const body = response.body as {
      success: boolean;
      data: TasksListResponse;
    };

    expect(mockTasksService.listTasks).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ page: 1, pageSize: 20, skip: 0, take: 20 }),
      expect.any(Object),
    );

    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          items: expect.arrayContaining([
            expect.objectContaining({ id: task.id, title: task.title }),
          ]),
          meta: expect.objectContaining({ total: 1 }),
        }),
      }),
    );
  });

  it('POST /tasks creates a task', async () => {
    const payload = { title: 'New task', description: 'Example' };
    const httpServer = app.getHttpServer();
    const response = await request(httpServer)
      .post('/tasks')
      .send(payload)
      .expect(201);

    expect(mockTasksService.createTask).toHaveBeenCalledWith(
      1,
      expect.objectContaining(payload),
    );

    const body = response.body as {
      success: boolean;
      data: TaskView;
    };

    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({ id: task.id, title: task.title }),
      }),
    );
  });
});
