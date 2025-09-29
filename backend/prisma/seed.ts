import {
  PrismaClient,
  TaskPriority,
  TaskStatus,
  TransactionType,
  Role,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.task.deleteMany();
  await prisma.financeTransaction.deleteMany();
  await prisma.financeAccount.deleteMany();
  await prisma.financeCategory.deleteMany();
  await prisma.user.deleteMany();

  // Admin seeding (for local/dev convenience)
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@orga.app';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin1234';
  const adminPasswordHash = await bcrypt.hash(adminPassword, 10);

  const demoPasswordHash = await bcrypt.hash('demo1234', 10);

  const admin = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash: adminPasswordHash,
      name: 'Admin',
      role: Role.ADMIN,
    },
  });

  const user = await prisma.user.create({
    data: {
      email: 'demo@orga.app',
      passwordHash: demoPasswordHash,
      name: 'Demo User',
    },
  });

  // Helper to seed finance data for a given user
  const seedFinanceForUser = async (userId: number, count = 40) => {
    await prisma.financeAccount.createMany({
      data: [
        { userId, name: 'Wallet', type: 'CASH', initialBalance: 500 },
        { userId, name: 'Nubank', type: 'CREDIT', initialBalance: 0 },
        { userId, name: 'Inter', type: 'BANK', initialBalance: 1500 },
      ],
    });

    await prisma.financeCategory.createMany({
      data: [
        { userId, name: 'Housing' },
        { userId, name: 'Food' },
        { userId, name: 'Transport' },
        { userId, name: 'Leisure' },
        { userId, name: 'Health' },
      ],
    });

    const createdAccounts = await prisma.financeAccount.findMany({
      where: { userId },
    });
    const createdCategories = await prisma.financeCategory.findMany({
      where: { userId },
    });

    const now = new Date();
    const transactionsData = Array.from({ length: count }).map((_, index) => {
      const occurredAt = new Date(now);
      occurredAt.setDate(
        occurredAt.getDate() - Math.floor(Math.random() * 90),
      );

      const account = createdAccounts[index % createdAccounts.length];
      const category = createdCategories[index % createdCategories.length];
      const type =
        index % 4 === 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
      const amount =
        type === TransactionType.INCOME
          ? Number((Math.random() * 1000 + 500).toFixed(2))
          : Number((Math.random() * 200 + 20).toFixed(2));

      return {
        userId,
        type,
        accountId: account.id,
        categoryId: category.id,
        amount,
        occurredAt,
        notes: `${
          type === TransactionType.INCOME ? 'Payment' : 'Expense'
        } #${index + 1}`,
        tags: type === TransactionType.INCOME ? ['income'] : ['expense'],
      };
    });

    await prisma.financeTransaction.createMany({ data: transactionsData });

    const tasksData = Array.from({ length: 20 }).map((_, index) => {
      const createdAt = new Date(now);
      createdAt.setDate(createdAt.getDate() - index);
      const completed = index % 2 === 0;

      return {
        userId,
        title: `Task ${index + 1}`,
        description: 'Seed task',
        status: completed ? TaskStatus.COMPLETED : TaskStatus.TODO,
        priority: [
          TaskPriority.LOW,
          TaskPriority.MEDIUM,
          TaskPriority.HIGH,
          TaskPriority.URGENT,
        ][index % 4],
        createdAt,
        updatedAt: createdAt,
        dueDate: new Date(createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      };
    });

    await prisma.task.createMany({ data: tasksData });
  };

  // Seed both demo and admin with sample data (admin gets fewer records)
  await seedFinanceForUser(user.id, 40);
  await seedFinanceForUser(admin.id, 25);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
