import {
  CanActivate,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { Request } from 'express';
import {
  TransactionType,
  TransactionGroupType,
  TransferDirection,
} from '@prisma/client';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import { PaginationParams } from '../src/common/dto/pagination.dto';
import {
  AccountView,
  FinanceService,
  TransactionView,
} from '../src/finance/finance.service';
import { FinanceController } from '../src/finance/finance.controller';

type TransactionsListResponse = {
  items: TransactionView[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
};

describe('FinanceController (e2e)', () => {
  let app: INestApplication;

  const account: AccountView = {
    id: 1,
    name: 'Wallet',
    type: 'CHECKING',
    initialBalance: 1000,
    createdAt: new Date('2025-01-01T00:00:00.000Z'),
    balance: 1350,
    totals: {
      income: 600,
      expense: 250,
      transferIn: 50,
      transferOut: 50,
      transferNet: 0,
    },
  };

  const transaction: TransactionView = {
    id: 42,
    groupId: 'group-1',
    groupType: TransactionGroupType.TRANSFER,
    type: TransactionType.TRANSFER,
    amount: 150,
    occurredAt: new Date('2025-02-01T00:00:00.000Z'),
    accountId: 1,
    accountName: 'Wallet',
    transferAccountId: 2,
    transferAccountName: 'Savings',
    transferDirection: TransferDirection.OUT,
    categoryId: null,
    categoryName: null,
    notes: 'Transfer to savings',
    tags: ['savings'],
    attachmentUrl: null,
    installmentsTotal: 3,
    installmentNumber: 1,
    recurrenceRRule: null,
  };

  const mockFinanceService: Partial<FinanceService> = {
    listAccounts: jest.fn(() => Promise.resolve([account])),
    listTransactions: jest.fn(
      (_userId: number, _pagination: PaginationParams, _filters) =>
        Promise.resolve({
          items: [transaction],
          meta: { page: 1, pageSize: 20, total: 1, pageCount: 1 },
        }),
    ),
    createTransaction: jest.fn(() => Promise.resolve(transaction)),
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
      controllers: [FinanceController],
      providers: [
        {
          provide: FinanceService,
          useValue: mockFinanceService,
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

  it('GET /finance/accounts returns account totals with transfers', async () => {
    const httpServer = app.getHttpServer();
    const response = await request(httpServer)
      .get('/finance/accounts')
      .expect(200);

    expect(mockFinanceService.listAccounts).toHaveBeenCalledWith(1);

    const body = response.body as {
      success: boolean;
      data: AccountView[];
    };

    expect(body).toEqual(
      expect.objectContaining({
        success: true,
        data: expect.arrayContaining([
          expect.objectContaining({
            id: account.id,
            totals: expect.objectContaining({
              transferIn: account.totals.transferIn,
              transferOut: account.totals.transferOut,
              transferNet: account.totals.transferNet,
            }),
          }),
        ]),
      }),
    );
  });

  it('GET /finance/transactions applies filters including q and date aliases', async () => {
    const httpServer = app.getHttpServer();
    const response = await request(httpServer)
      .get('/finance/transactions')
      .query({
        type: TransactionType.TRANSFER,
        accountId: 1,
        categoryId: 2,
        dateFrom: '2025-01-01T00:00:00.000Z',
        dateTo: '2025-02-01T00:00:00.000Z',
        q: 'savings',
      })
      .expect(200);

    expect(mockFinanceService.listTransactions).toHaveBeenCalledWith(
      1,
      expect.objectContaining({ page: 1, pageSize: 20, skip: 0, take: 20 }),
      expect.objectContaining({
        type: [TransactionType.TRANSFER],
        accountId: 1,
        categoryId: 2,
        from: '2025-01-01T00:00:00.000Z',
        to: '2025-02-01T00:00:00.000Z',
        q: 'savings',
      }),
    );

    const body = response.body as {
      success: boolean;
      data: TransactionsListResponse;
    };

    expect(body.data.items[0]).toEqual(
      expect.objectContaining({
        transferAccountName: transaction.transferAccountName,
        transferDirection: transaction.transferDirection,
      }),
    );
  });

  it('POST /finance/transactions forwards payload to service', async () => {
    const httpServer = app.getHttpServer();
    const payload = {
      type: TransactionType.EXPENSE,
      accountId: 1,
      amount: 45.5,
      occurredAt: '2025-03-10T12:00:00.000Z',
    };

    await request(httpServer)
      .post('/finance/transactions')
      .send(payload)
      .expect(201);

    expect(mockFinanceService.createTransaction).toHaveBeenCalledWith(
      1,
      expect.objectContaining(payload),
    );
  });
});
