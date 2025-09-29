import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';

import {
  Prisma,
  TransactionGroupType,
  TransactionType,
  TransferDirection,
} from '@prisma/client';

import { PaginationMeta, PaginationParams } from '../common/dto/pagination.dto';

import { PrismaService } from '../prisma/prisma.service';

import { BudgetQueryDto } from './dto/budget-query.dto';

import { CreateAccountDto } from './dto/create-account.dto';

import { CreateBudgetDto } from './dto/create-budget.dto';

import { CreateCategoryDto } from './dto/create-category.dto';

import { CreateTransactionDto } from './dto/create-transaction.dto';

import { TransactionQueryDto } from './dto/transaction-query.dto';

import { UpdateAccountDto } from './dto/update-account.dto';

import { UpdateBudgetDto } from './dto/update-budget.dto';

import { UpdateCategoryDto } from './dto/update-category.dto';

import { UpdateTransactionDto } from './dto/update-transaction.dto';

export interface AccountTotals {
  income: number;

  expense: number;

  transferIn: number;

  transferOut: number;

  transferNet: number;
}

export interface AccountView {
  id: number;

  name: string;

  type: string;

  initialBalance: number;

  createdAt: Date;

  balance: number;

  totals: AccountTotals;
}

export interface CategoryNode {
  id: number;

  name: string;

  parentId: number | null;

  children: CategoryNode[];
}

export interface TransactionView {
  id: number;

  groupId?: string | null;

  groupType?: TransactionGroupType | null;

  type: TransactionType;

  amount: number;

  occurredAt: Date;

  accountId: number;

  accountName: string;

  transferAccountId?: number | null;

  transferAccountName?: string | null;

  transferDirection?: TransferDirection | null;

  categoryId?: number | null;

  categoryName?: string | null;

  notes?: string | null;

  tags: string[];

  attachmentUrl?: string | null;

  installmentsTotal?: number | null;

  installmentNumber?: number | null;

  recurrenceRRule?: string | null;
}

export interface BudgetView {
  id: number;

  categoryId: number;

  categoryName: string;

  month: number;

  year: number;

  plannedAmount: number;

  actualAmount: number;
}

/**
 * FinanceService
 * - Business logic for Accounts, Categories, Transactions, Budgets
 * - Uses Prisma `$transaction` for multi-row consistency (transfers, installments)
 * - Uses `groupBy`/`aggregate` for efficient summaries
 */
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listAccounts(userId: number): Promise<AccountView[]> {
    const [accounts, groupedTransactions] = await Promise.all([
      this.prisma.financeAccount.findMany({
        where: { userId },

        orderBy: { createdAt: 'asc' },
      }),

      this.prisma.financeTransaction.groupBy({
        by: ['accountId', 'type', 'transferDirection'],

        _sum: { amount: true },

        where: { userId },
      }),
    ]);

    const totalsMap = new Map<number, AccountTotals>();

    for (const group of groupedTransactions) {
      const summary = totalsMap.get(group.accountId) ?? {
        income: 0,

        expense: 0,

        transferIn: 0,

        transferOut: 0,

        transferNet: 0,
      };

      const amount = Number(group._sum.amount ?? 0);

      switch (group.type) {
        case TransactionType.INCOME:
          summary.income += amount;

          break;

        case TransactionType.EXPENSE:
          summary.expense += amount;

          break;

        case TransactionType.TRANSFER: {
          const direction = group.transferDirection;

          if (direction === TransferDirection.IN) {
            summary.transferIn += amount;
          } else if (direction === TransferDirection.OUT) {
            summary.transferOut += amount;
          } else if (amount >= 0) {
            summary.transferIn += amount;
          } else {
            summary.transferOut += Math.abs(amount);
          }

          break;
        }
      }

      summary.transferNet = summary.transferIn - summary.transferOut;

      totalsMap.set(group.accountId, summary);
    }

    return accounts.map((account) => {
      const totals = totalsMap.get(account.id) ?? {
        income: 0,

        expense: 0,

        transferIn: 0,

        transferOut: 0,

        transferNet: 0,
      };

      const balance =
        Number(account.initialBalance) +
        totals.income +
        totals.transferIn -
        totals.expense -
        totals.transferOut;

      return {
        id: account.id,

        name: account.name,

        type: account.type,

        initialBalance: Number(account.initialBalance),

        createdAt: account.createdAt,

        balance,

        totals,
      } satisfies AccountView;
    });
  }

  async getAccount(userId: number, id: number): Promise<AccountView> {
    const account = await this.prisma.financeAccount.findFirst({
      where: { id, userId },
    });

    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const grouped = await this.prisma.financeTransaction.groupBy({
      by: ['type', 'transferDirection'],

      where: { accountId: account.id, userId },

      _sum: { amount: true },
    });

    const summary: AccountTotals = {
      income: 0,

      expense: 0,

      transferIn: 0,

      transferOut: 0,

      transferNet: 0,
    };

    for (const item of grouped) {
      const amount = Number(item._sum.amount ?? 0);

      switch (item.type) {
        case TransactionType.INCOME:
          summary.income += amount;

          break;

        case TransactionType.EXPENSE:
          summary.expense += amount;

          break;

        case TransactionType.TRANSFER:
          if (item.transferDirection === TransferDirection.IN) {
            summary.transferIn += amount;
          } else if (item.transferDirection === TransferDirection.OUT) {
            summary.transferOut += amount;
          } else if (amount >= 0) {
            summary.transferIn += amount;
          } else {
            summary.transferOut += Math.abs(amount);
          }

          break;
      }
    }

    summary.transferNet = summary.transferIn - summary.transferOut;

    const balance =
      Number(account.initialBalance) +
      summary.income +
      summary.transferIn -
      summary.expense -
      summary.transferOut;

    return {
      id: account.id,

      name: account.name,

      type: account.type,

      initialBalance: Number(account.initialBalance),

      createdAt: account.createdAt,

      totals: summary,

      balance,
    } satisfies AccountView;
  }

  async createAccount(
    userId: number,

    dto: CreateAccountDto,
  ): Promise<AccountView> {
    try {
      const account = await this.prisma.financeAccount.create({
        data: {
          userId,

          name: dto.name,

          type: dto.type,

          initialBalance: new Prisma.Decimal(dto.initialBalance ?? 0),
        },
      });

      return {
        id: account.id,

        name: account.name,

        type: account.type,

        initialBalance: Number(account.initialBalance),

        createdAt: account.createdAt,

        totals: {
          income: 0,
          expense: 0,
          transferIn: 0,
          transferOut: 0,
          transferNet: 0,
        },

        balance: Number(account.initialBalance),
      } satisfies AccountView;
    } catch (error) {
      this.handlePrismaError(error, 'Account');
    }
  }

  async updateAccount(
    userId: number,

    id: number,

    dto: UpdateAccountDto,
  ): Promise<AccountView> {
    await this.ensureAccountOwnership(userId, id);

    try {
      await this.prisma.financeAccount.update({
        where: { id },

        data: {
          name: dto.name,

          type: dto.type,

          initialBalance:
            dto.initialBalance !== undefined
              ? new Prisma.Decimal(dto.initialBalance)
              : undefined,
        },
      });

      return this.getAccount(userId, id);
    } catch (error) {
      this.handlePrismaError(error, 'Account');
    }
  }

  async deleteAccount(userId: number, id: number): Promise<void> {
    await this.ensureAccountOwnership(userId, id);

    await this.prisma.financeAccount.delete({ where: { id } });
  }

  async listCategories(userId: number) {
    return this.prisma.financeCategory.findMany({
      where: { userId },

      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });
  }

  async getCategoryTree(userId: number): Promise<CategoryNode[]> {
    const categories = await this.prisma.financeCategory.findMany({
      where: { userId },

      orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    });

    const map = new Map<number, CategoryNode>();

    const roots: CategoryNode[] = [];

    for (const category of categories) {
      map.set(category.id, {
        id: category.id,

        name: category.name,

        parentId: category.parentId ?? null,

        children: [],
      });
    }

    for (const category of categories) {
      const node = map.get(category.id);

      if (!node) continue;

      if (category.parentId) {
        const parent = map.get(category.parentId);

        if (parent) {
          parent.children.push(node);
        }
      } else {
        roots.push(node);
      }
    }

    return roots;
  }

  async createCategory(userId: number, dto: CreateCategoryDto) {
    if (dto.parentId) {
      await this.ensureCategoryOwnership(userId, dto.parentId);
    }

    try {
      return await this.prisma.financeCategory.create({
        data: {
          name: dto.name,

          userId,

          parentId: dto.parentId ?? null,
        },
      });
    } catch (error) {
      this.handlePrismaError(error, 'Category');
    }
  }

  async updateCategory(userId: number, id: number, dto: UpdateCategoryDto) {
    await this.ensureCategoryOwnership(userId, id);

    if (dto.parentId === id) {
      throw new ConflictException('Category cannot be its own parent');
    }

    if (dto.parentId) {
      await this.ensureCategoryOwnership(userId, dto.parentId);
    }

    const parentId =
      dto.parentId === undefined
        ? undefined
        : dto.parentId === null
          ? null
          : dto.parentId;

    try {
      return await this.prisma.financeCategory.update({
        where: { id },

        data: {
          name: dto.name,

          parentId,
        },
      });
    } catch (error) {
      this.handlePrismaError(error, 'Category');
    }
  }

  async deleteCategory(userId: number, id: number): Promise<void> {
    await this.ensureCategoryOwnership(userId, id);

    await this.prisma.financeCategory.delete({ where: { id } });
  }

  async listTransactions(
    userId: number,

    pagination: PaginationParams,

    filters: TransactionQueryDto,
  ): Promise<{ items: TransactionView[]; meta: PaginationMeta }> {
    const andFilters: Prisma.FinanceTransactionWhereInput[] = [{ userId }];

    if (filters.type?.length) {
      andFilters.push({ type: { in: filters.type } });
    }

    if (filters.accountId) {
      andFilters.push({ accountId: filters.accountId });
    }

    if (filters.categoryId) {
      andFilters.push({ categoryId: filters.categoryId });
    }

    if (filters.from || filters.to) {
      const occurred: Prisma.DateTimeFilter = {};

      if (filters.from) {
        occurred.gte = new Date(filters.from);
      }

      if (filters.to) {
        occurred.lte = new Date(filters.to);
      }

      andFilters.push({ occurredAt: occurred });
    }

    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      const amountFilter: Prisma.DecimalFilter = {};

      if (filters.minAmount !== undefined) {
        amountFilter.gte = new Prisma.Decimal(filters.minAmount);
      }

      if (filters.maxAmount !== undefined) {
        amountFilter.lte = new Prisma.Decimal(filters.maxAmount);
      }

      andFilters.push({ amount: amountFilter });
    }

    if (filters.tags?.length) {
      andFilters.push({
        tags: { hasSome: this.normalizeTags(filters.tags) },
      });
    }

    if (filters.q) {
      const normalizedQuery = filters.q;

      const normalizedTag = this.normalizeTags([filters.q])[0];

      const orConditions: Prisma.FinanceTransactionWhereInput[] = [
        { notes: { contains: normalizedQuery, mode: 'insensitive' } },

        {
          attachmentUrl: { contains: normalizedQuery, mode: 'insensitive' },
        },

        {
          account: { name: { contains: normalizedQuery, mode: 'insensitive' } },
        },

        {
          category: {
            name: { contains: normalizedQuery, mode: 'insensitive' },
          },
        },
      ];

      if (normalizedTag) {
        orConditions.push({ tags: { has: normalizedTag } });
      }

      andFilters.push({ OR: orConditions });
    }

    const where: Prisma.FinanceTransactionWhereInput = {
      AND: andFilters,
    };

    const transactions = await this.prisma.financeTransaction.findMany({
      where,

      skip: pagination.skip,

      take: pagination.take,

      orderBy: { occurredAt: 'desc' },

      include: {
        account: true,

        category: true,

        transferAccount: true,
      },
    });

    const total = await this.prisma.financeTransaction.count({ where });

    const items = transactions.map((transaction) =>
      this.mapTransaction(transaction),
    );

    const meta: PaginationMeta = {
      page: pagination.page,

      pageSize: pagination.pageSize,

      total,

      pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };

    return { items, meta };
  }

  async getTransaction(userId: number, id: number): Promise<TransactionView> {
    const transaction = await this.prisma.financeTransaction.findFirst({
      where: { id, userId },

      include: { account: true, category: true, transferAccount: true },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    return this.mapTransaction(transaction);
  }

  async createTransaction(
    userId: number,

    dto: CreateTransactionDto,
  ): Promise<TransactionView> {
    await this.ensureAccountOwnership(userId, dto.accountId);

    if (dto.categoryId) {
      await this.ensureCategoryOwnership(userId, dto.categoryId);
    }

    const normalizedTags = this.normalizeTags(dto.tags);

    const amountValue = Number(dto.amount);

    if (!(amountValue > 0)) {
      throw new ConflictException('Amount must be greater than zero');
    }

    const totalInstallments =
      dto.installmentsTotal && dto.installmentsTotal > 0
        ? dto.installmentsTotal
        : 1;

    const hasInstallments = totalInstallments > 1;

    if (
      hasInstallments &&
      dto.installmentNumber &&
      dto.installmentNumber !== 1
    ) {
      throw new ConflictException(
        'When creating instalment plans provide only installmentsTotal or set installmentNumber to 1',
      );
    }

    const schedule = this.buildInstallmentSchedule(
      amountValue,

      totalInstallments,

      new Date(dto.occurredAt),
    );

    const singleInstallmentNumber = dto.installmentNumber ?? null;

    if (dto.type === TransactionType.TRANSFER) {
      if (!dto.targetAccountId) {
        throw new ConflictException('Transfers require targetAccountId');
      }

      if (dto.targetAccountId === dto.accountId) {
        throw new ConflictException(
          'Transfers require different source and target accounts',
        );
      }

      await this.ensureAccountOwnership(userId, dto.targetAccountId);

      const targetAccountId = dto.targetAccountId;
      const sourceAccountId = dto.accountId;
      const groupId = randomUUID();

      const createdTransfers = await this.prisma.$transaction(async (tx) => {
        const created: Array<
          Prisma.FinanceTransactionGetPayload<{
            include: { account: true; category: true; transferAccount: true };
          }>
        > = [];

        for (const installment of schedule) {
          const source = await tx.financeTransaction.create({
            data: {
              userId,

              type: TransactionType.TRANSFER,

              accountId: sourceAccountId,

              categoryId: null,

              transferAccountId: targetAccountId,

              transferDirection: TransferDirection.OUT,

              amount: installment.amount,

              occurredAt: installment.occurredAt,

              notes: dto.notes,

              tags: normalizedTags,

              attachmentUrl: dto.attachmentUrl,

              installmentsTotal: hasInstallments
                ? totalInstallments
                : (dto.installmentsTotal ?? null),

              installmentNumber: hasInstallments
                ? installment.installmentNumber
                : singleInstallmentNumber,

              recurrenceRRule: dto.recurrenceRRule,

              groupId,

              groupType: TransactionGroupType.TRANSFER,
            },

            include: { account: true, category: true, transferAccount: true },
          });

          await tx.financeTransaction.create({
            data: {
              userId,

              type: TransactionType.TRANSFER,

              accountId: targetAccountId,

              categoryId: null,

              transferAccountId: sourceAccountId,

              transferDirection: TransferDirection.IN,

              amount: installment.amount,

              occurredAt: installment.occurredAt,

              notes: dto.notes,

              tags: normalizedTags,

              attachmentUrl: dto.attachmentUrl,

              installmentsTotal: hasInstallments
                ? totalInstallments
                : (dto.installmentsTotal ?? null),

              installmentNumber: hasInstallments
                ? installment.installmentNumber
                : singleInstallmentNumber,

              recurrenceRRule: dto.recurrenceRRule,

              groupId,

              groupType: TransactionGroupType.TRANSFER,
            },
          });

          created.push(source);
        }

        return created;
      });

      return this.mapTransaction(createdTransfers[0]);
    }

    const groupId = hasInstallments ? randomUUID() : null;

    const createdTransactions = await this.prisma.$transaction(async (tx) => {
      const created: Array<
        Prisma.FinanceTransactionGetPayload<{
          include: { account: true; category: true; transferAccount: true };
        }>
      > = [];

      for (const installment of schedule) {
        const transaction = await tx.financeTransaction.create({
          data: {
            userId,

            type: dto.type,

            accountId: dto.accountId,

            categoryId: dto.categoryId ?? null,

            amount: installment.amount,

            occurredAt: installment.occurredAt,

            notes: dto.notes,

            tags: normalizedTags,

            attachmentUrl: dto.attachmentUrl,

            installmentsTotal: hasInstallments
              ? totalInstallments
              : (dto.installmentsTotal ?? null),

            installmentNumber: hasInstallments
              ? installment.installmentNumber
              : singleInstallmentNumber,

            recurrenceRRule: dto.recurrenceRRule,

            groupId,

            groupType: hasInstallments
              ? TransactionGroupType.INSTALLMENT
              : null,
          },

          include: { account: true, category: true, transferAccount: true },
        });

        created.push(transaction);
      }

      return created;
    });

    return this.mapTransaction(createdTransactions[0]);
  }

  async updateTransaction(
    userId: number,

    id: number,

    dto: UpdateTransactionDto,
  ): Promise<TransactionView> {
    const existing = await this.prisma.financeTransaction.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      throw new NotFoundException('Transaction not found');
    }

    if (dto.accountId) {
      await this.ensureAccountOwnership(userId, dto.accountId);
    }

    if (dto.categoryId) {
      await this.ensureCategoryOwnership(userId, dto.categoryId);
    }

    const normalizedTags = dto.tags ? this.normalizeTags(dto.tags) : undefined;

    if (existing.groupType === TransactionGroupType.TRANSFER) {
      const disallowedMutation =
        dto.type !== undefined ||
        dto.amount !== undefined ||
        dto.accountId !== undefined ||
        dto.categoryId !== undefined ||
        dto.targetAccountId !== undefined ||
        dto.installmentsTotal !== undefined ||
        dto.installmentNumber !== undefined;

      if (disallowedMutation) {
        throw new ConflictException(
          'Transfers can only update metadata (notes, tags, attachmentUrl, occurredAt, recurrence). Delete and recreate to change amount or accounts.',
        );
      }

      const updateData: Prisma.FinanceTransactionUpdateManyMutationInput = {};

      if (dto.notes !== undefined) {
        updateData.notes = dto.notes;
      }

      if (dto.attachmentUrl !== undefined) {
        updateData.attachmentUrl = dto.attachmentUrl;
      }

      if (dto.recurrenceRRule !== undefined) {
        updateData.recurrenceRRule = dto.recurrenceRRule;
      }

      if (dto.occurredAt) {
        updateData.occurredAt = new Date(dto.occurredAt);
      }

      if (normalizedTags) {
        updateData.tags = { set: normalizedTags };
      }

      if (Object.keys(updateData).length === 0) {
        return this.getTransaction(userId, id);
      }

      await this.prisma.financeTransaction.updateMany({
        where: { userId, groupId: existing.groupId ?? undefined },

        data: updateData,
      });

      return this.getTransaction(userId, id);
    }

    await this.prisma.financeTransaction.update({
      where: { id },

      data: {
        type: dto.type,

        accountId: dto.accountId,

        categoryId:
          dto.categoryId === undefined ? undefined : (dto.categoryId ?? null),

        amount:
          dto.amount !== undefined ? new Prisma.Decimal(dto.amount) : undefined,

        occurredAt: dto.occurredAt ? new Date(dto.occurredAt) : undefined,

        notes: dto.notes,

        attachmentUrl: dto.attachmentUrl,

        installmentsTotal: dto.installmentsTotal,

        installmentNumber: dto.installmentNumber,

        recurrenceRRule: dto.recurrenceRRule,

        tags: normalizedTags,
      },
    });

    return this.getTransaction(userId, id);
  }

  async deleteTransaction(userId: number, id: number): Promise<void> {
    const transaction = await this.prisma.financeTransaction.findFirst({
      where: { id, userId },
    });

    if (!transaction) {
      throw new NotFoundException('Transaction not found');
    }

    if (transaction.groupType === TransactionGroupType.TRANSFER) {
      await this.prisma.financeTransaction.deleteMany({
        where: { userId, groupId: transaction.groupId ?? undefined },
      });

      return;
    }

    await this.prisma.financeTransaction.delete({ where: { id } });
  }

  async listBudgets(
    userId: number,

    filters: BudgetQueryDto,
  ): Promise<BudgetView[]> {
    const where: Prisma.BudgetWhereInput = { userId };

    if (filters.year) where.year = filters.year;

    if (filters.month) where.month = filters.month;

    const budgets = await this.prisma.budget.findMany({
      where,

      include: { category: true },

      orderBy: [{ year: 'desc' }, { month: 'desc' }],
    });

    if (!budgets.length) {
      return [];
    }

    const categoryIds = budgets.map((budget) => budget.categoryId);

    const minTimestamp = Math.min(
      ...budgets.map((b) => Date.UTC(b.year, b.month - 1, 1)),
    );

    const maxTimestamp = Math.max(
      ...budgets.map((b) => Date.UTC(b.year, b.month, 1)),
    );

    const transactions = await this.prisma.financeTransaction.findMany({
      where: {
        userId,

        type: TransactionType.EXPENSE,

        categoryId: { in: categoryIds },

        occurredAt: {
          gte: new Date(minTimestamp),

          lt: new Date(maxTimestamp),
        },
      },

      select: {
        categoryId: true,

        amount: true,

        occurredAt: true,
      },
    });

    const actualMap = new Map<string, number>();

    for (const transaction of transactions) {
      if (!transaction.categoryId) continue;

      const year = transaction.occurredAt.getUTCFullYear();

      const month = transaction.occurredAt.getUTCMonth() + 1;

      const key = `${transaction.categoryId}-${year}-${month}`;

      actualMap.set(
        key,

        (actualMap.get(key) ?? 0) + Number(transaction.amount),
      );
    }

    return budgets.map((budget) => {
      const key = `${budget.categoryId}-${budget.year}-${budget.month}`;

      return {
        id: budget.id,

        categoryId: budget.categoryId,

        categoryName: budget.category.name,

        month: budget.month,

        year: budget.year,

        plannedAmount: Number(budget.plannedAmount),

        actualAmount: actualMap.get(key) ?? 0,
      } satisfies BudgetView;
    });
  }

  async createBudget(
    userId: number,

    dto: CreateBudgetDto,
  ): Promise<BudgetView> {
    await this.ensureCategoryOwnership(userId, dto.categoryId);

    try {
      const budget = await this.prisma.budget.create({
        data: {
          userId,

          categoryId: dto.categoryId,

          month: dto.month,

          year: dto.year,

          plannedAmount: new Prisma.Decimal(dto.plannedAmount),
        },

        include: { category: true },
      });

      return {
        id: budget.id,

        categoryId: budget.categoryId,

        categoryName: budget.category.name,

        month: budget.month,

        year: budget.year,

        plannedAmount: Number(budget.plannedAmount),

        actualAmount: 0,
      } satisfies BudgetView;
    } catch (error) {
      this.handlePrismaError(error, 'Budget');
    }
  }

  async updateBudget(
    userId: number,

    id: number,

    dto: UpdateBudgetDto,
  ): Promise<BudgetView> {
    await this.ensureBudgetOwnership(userId, id);

    if (dto.categoryId)
      await this.ensureCategoryOwnership(userId, dto.categoryId);

    try {
      await this.prisma.budget.update({
        where: { id },

        data: {
          categoryId: dto.categoryId,

          month: dto.month,

          year: dto.year,

          plannedAmount:
            dto.plannedAmount !== undefined
              ? new Prisma.Decimal(dto.plannedAmount)
              : undefined,
        },
      });

      return this.getBudget(userId, id);
    } catch (error) {
      this.handlePrismaError(error, 'Budget');
    }
  }

  async deleteBudget(userId: number, id: number): Promise<void> {
    await this.ensureBudgetOwnership(userId, id);

    await this.prisma.budget.delete({ where: { id } });
  }

  async getBudget(userId: number, id: number): Promise<BudgetView> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },

      include: { category: true },
    });

    if (!budget) {
      throw new NotFoundException('Budget not found');
    }

    const actual = await this.prisma.financeTransaction.aggregate({
      _sum: { amount: true },

      where: {
        userId,

        categoryId: budget.categoryId,

        type: TransactionType.EXPENSE,

        occurredAt: {
          gte: new Date(Date.UTC(budget.year, budget.month - 1, 1)),

          lt: new Date(Date.UTC(budget.year, budget.month, 1)),
        },
      },
    });

    return {
      id: budget.id,

      categoryId: budget.categoryId,

      categoryName: budget.category.name,

      month: budget.month,

      year: budget.year,

      plannedAmount: Number(budget.plannedAmount),

      actualAmount: Number(actual._sum.amount ?? 0),
    } satisfies BudgetView;
  }

  private mapTransaction(
    transaction: Prisma.FinanceTransactionGetPayload<{
      include: { account: true; category: true; transferAccount: true };
    }>,
  ): TransactionView {
    return {
      id: transaction.id,

      groupId: transaction.groupId ?? null,

      groupType: transaction.groupType ?? null,

      type: transaction.type,

      amount: Number(transaction.amount),

      occurredAt: transaction.occurredAt,

      accountId: transaction.accountId,

      accountName: transaction.account.name,

      transferAccountId: transaction.transferAccountId ?? null,

      transferAccountName: transaction.transferAccount?.name ?? null,

      transferDirection: transaction.transferDirection ?? null,

      categoryId: transaction.categoryId,

      categoryName: transaction.category?.name ?? null,

      notes: transaction.notes,

      tags: transaction.tags ?? [],

      attachmentUrl: transaction.attachmentUrl,

      installmentsTotal: transaction.installmentsTotal,

      installmentNumber: transaction.installmentNumber,

      recurrenceRRule: transaction.recurrenceRRule,
    };
  }

  private buildInstallmentSchedule(
    amount: number,

    total: number,

    startDate: Date,
  ): Array<{
    amount: Prisma.Decimal;
    occurredAt: Date;
    installmentNumber: number;
  }> {
    const totalInstallments = Math.max(1, total);

    const totalCents = Math.round(amount * 100);

    const baseCents = Math.floor(totalCents / totalInstallments);

    const remainder = totalCents - baseCents * totalInstallments;

    const schedule: Array<{
      amount: Prisma.Decimal;
      occurredAt: Date;
      installmentNumber: number;
    }> = [];

    for (let index = 0; index < totalInstallments; index += 1) {
      const cents = baseCents + (index < remainder ? 1 : 0);

      const decimalAmount = new Prisma.Decimal((cents / 100).toFixed(2));

      const occurredAt = new Date(startDate);

      occurredAt.setMonth(occurredAt.getMonth() + index);

      schedule.push({
        amount: decimalAmount,

        occurredAt,

        installmentNumber: index + 1,
      });
    }

    return schedule;
  }

  private normalizeTags(tags?: string[]): string[] {
    if (!tags?.length) {
      return [];
    }

    return Array.from(
      new Set(tags.map((tag) => tag.trim().toLowerCase()).filter(Boolean)),
    );
  }

  private async ensureAccountOwnership(userId: number, accountId?: number) {
    if (!accountId) return;

    const exists = await this.prisma.financeAccount.findFirst({
      where: { id: accountId, userId },
    });

    if (!exists) {
      throw new NotFoundException('Account not found');
    }
  }

  private async ensureCategoryOwnership(
    userId: number,

    categoryId?: number | null,
  ) {
    if (!categoryId) return;

    const exists = await this.prisma.financeCategory.findFirst({
      where: { id: categoryId, userId },
    });

    if (!exists) {
      throw new NotFoundException('Category not found');
    }
  }

  private async ensureBudgetOwnership(userId: number, budgetId: number) {
    const exists = await this.prisma.budget.findFirst({
      where: { id: budgetId, userId },
    });

    if (!exists) {
      throw new NotFoundException('Budget not found');
    }
  }

  private handlePrismaError(error: unknown, resource: string): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          `${resource} already exists with the provided unique fields`,
        );
      }
    }

    throw error;
  }
}
