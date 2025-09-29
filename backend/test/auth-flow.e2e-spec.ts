import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

type ApiResponse<T> = {
  success: boolean;
  data: T;
  meta?: unknown;
};

describe('End-to-end flows', () => {
  let app: INestApplication;
  let httpServer: any;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );

    await app.init();
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  const uniqueCredentials = () => {
    const token = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    return {
      email: `e2e-${token}@example.com`,
      password: `Pass1234!${token}`,
      name: 'E2E Tester',
    };
  };

  async function registerUser() {
    const credentials = uniqueCredentials();
    const registerResponse = await request(httpServer)
      .post('/auth/register')
      .send(credentials)
      .expect(201);

    const registerBody = registerResponse.body as ApiResponse<{
      accessToken: string;
      refreshToken: string;
      user: { id: number };
    }>;

    return {
      credentials,
      tokens: registerBody.data,
    };
  }

  async function loginUser(email: string, password: string) {
    const response = await request(httpServer)
      .post('/auth/login')
      .send({ email, password })
      .expect(201);
    return response.body as ApiResponse<{
      accessToken: string;
      refreshToken: string;
      user: { id: number };
    }>;
  }

  describe('Authentication', () => {
    it('logs in and refreshes tokens', async () => {
      const { credentials } = await registerUser();

      const login = await loginUser(credentials.email, credentials.password);
      expect(login.success).toBe(true);
      expect(login.data.accessToken).toBeDefined();
      expect(login.data.refreshToken).toBeDefined();

      const refreshResponse = await request(httpServer)
        .post('/auth/refresh')
        .send({ refreshToken: login.data.refreshToken })
        .expect(201);

      const refreshBody = refreshResponse.body as ApiResponse<{
        accessToken: string;
        refreshToken: string;
        user: { id: number };
      }>;

      expect(refreshBody.success).toBe(true);
      expect(refreshBody.data.accessToken).toBeDefined();
      expect(refreshBody.data.refreshToken).toBeDefined();
    });
  });

  describe('Tasks', () => {
    it('creates a task successfully', async () => {
      const { tokens } = await registerUser();

      const payload = {
        title: 'Integration task',
        description: 'Created via e2e test',
      };

      const response = await request(httpServer)
        .post('/tasks')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send(payload)
        .expect(201);

      const body = response.body as ApiResponse<{
        id: number;
        title: string;
        description: string | null;
        status: string;
      }>;

      expect(body.success).toBe(true);
      expect(body.data.title).toBe(payload.title);
    });
  });

  describe('Finance transactions', () => {
    it('lists transactions with filters applied', async () => {
      const { tokens } = await registerUser();

      const expenseDate = new Date();
      const from = new Date(expenseDate);
      from.setDate(expenseDate.getDate() - 1);
      const to = new Date(expenseDate);
      to.setDate(expenseDate.getDate() + 1);

      const accountResponse = await request(httpServer)
        .post('/finance/accounts')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({ name: 'Main account', type: 'checking', initialBalance: 500 })
        .expect(201);

      const accountBody = accountResponse.body as ApiResponse<{ id: number }>;
      const accountId = accountBody.data.id;

      // Expense transaction that should match filters
      await request(httpServer)
        .post('/finance/transactions')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          type: 'EXPENSE',
          accountId,
          amount: 42.5,
          occurredAt: expenseDate.toISOString(),
          notes: 'Groceries',
        })
        .expect(201);

      // Another transaction that should be filtered out
      await request(httpServer)
        .post('/finance/transactions')
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .send({
          type: 'INCOME',
          accountId,
          amount: 100,
          occurredAt: expenseDate.toISOString(),
          notes: 'Salary',
        })
        .expect(201);

      const listResponse = await request(httpServer)
        .get('/finance/transactions')
        .query({
          accountId,
          type: 'EXPENSE',
          from: from.toISOString(),
          to: to.toISOString(),
        })
        .set('Authorization', `Bearer ${tokens.accessToken}`)
        .expect(200);

      const listBody = listResponse.body as ApiResponse<{
        items: Array<{ type: string; notes: string }>;
        meta: { total: number };
      }>;

      expect(listBody.success).toBe(true);
      expect(listBody.data.items).toHaveLength(1);
      expect(listBody.data.items[0]).toEqual(
        expect.objectContaining({ type: 'EXPENSE', notes: 'Groceries' }),
      );
    });
  });
});
