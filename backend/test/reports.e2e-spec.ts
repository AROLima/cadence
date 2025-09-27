/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { Request } from 'express';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { ReportsController } from '../src/reports/reports.controller';
import { ReportsService } from '../src/reports/reports.service';

const mockReportsService = {
  getTasksProductivity: jest.fn(() =>
    Promise.resolve({
      daily: [
        { date: '2025-01-01', completed: 3 },
        { date: '2025-01-02', completed: 1 },
      ],
      averageLeadTimeHours: 12.5,
    }),
  ),
  getFinanceExpensesByCategory: jest.fn(() =>
    Promise.resolve([
      { categoryId: 1, categoryName: 'Food', amount: 200 },
      { categoryId: 2, categoryName: 'Transport', amount: 80 },
    ]),
  ),
  getFinanceMonthlySeries: jest.fn(() =>
    Promise.resolve([
      { period: '2025-01', income: 3000, expense: 1800, net: 1200 },
    ]),
  ),
  getFinanceBalanceByAccount: jest.fn(() =>
    Promise.resolve([
      {
        accountId: 1,
        name: 'Wallet',
        type: 'CHECKING',
        initialBalance: 1000,
        totals: {
          income: 500,
          expense: 200,
          transferIn: 50,
          transferOut: 25,
          transferNet: 25,
        },
        balance: 1325,
      },
    ]),
  ),
};

describe('ReportsController (e2e)', () => {
  let app: INestApplication;

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
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
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
    Object.values(mockReportsService).forEach((fn) =>
      (fn as jest.Mock).mockClear(),
    );
  });

  it('GET /reports/tasks/productivity forwards range filters', async () => {
    const httpServer = app.getHttpServer();
    const response = await request(httpServer)
      .get('/reports/tasks/productivity')
      .query({
        from: '2025-01-01T00:00:00.000Z',
        to: '2025-01-10T00:00:00.000Z',
      })
      .expect(200);

    expect(mockReportsService.getTasksProductivity).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        from: '2025-01-01T00:00:00.000Z',
        to: '2025-01-10T00:00:00.000Z',
      }),
    );

    expect(response.body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          daily: expect.any(Array),
          averageLeadTimeHours: expect.any(Number),
        }),
      }),
    );
  });

  it('GET /reports/finance/expenses-by-category validates month/year', async () => {
    const httpServer = app.getHttpServer();
    const response = await request(httpServer)
      .get('/reports/finance/expenses-by-category')
      .query({ month: 1, year: 2025 })
      .expect(200);

    expect(
      mockReportsService.getFinanceExpensesByCategory,
    ).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ month: 1, year: 2025 }),
    );

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ categoryName: 'Food', amount: 200 }),
      ]),
    );
  });

  it('GET /reports/finance/monthly-series forwards range params', async () => {
    const httpServer = app.getHttpServer();
    const response = await request(httpServer)
      .get('/reports/finance/monthly-series')
      .query({ fromMonth: 1, fromYear: 2025, toMonth: 3, toYear: 2025 })
      .expect(200);

    expect(mockReportsService.getFinanceMonthlySeries).toHaveBeenCalledWith(
      1,
      expect.objectContaining({
        fromMonth: 1,
        fromYear: 2025,
        toMonth: 3,
        toYear: 2025,
      }),
    );

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ period: '2025-01', net: 1200 }),
      ]),
    );
  });

  it('GET /reports/finance/balance-by-account returns balances', async () => {
    const httpServer = app.getHttpServer();
    const response = await request(httpServer)
      .get('/reports/finance/balance-by-account')
      .expect(200);

    expect(mockReportsService.getFinanceBalanceByAccount).toHaveBeenCalledWith(
      1,
    );

    expect(response.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          accountId: 1,
          balance: 1325,
          totals: expect.objectContaining({ transferNet: 25 }),
        }),
      ]),
    );
  });
});
