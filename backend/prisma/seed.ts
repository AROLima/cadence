import {
  PrismaClient,
  TaskPriority,
  TaskStatus,
  TransactionType,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  await prisma.task.deleteMany();
  await prisma.financeTransaction.deleteMany();
  await prisma.financeAccount.deleteMany();
  await prisma.financeCategory.deleteMany();
  await prisma.user.deleteMany();

  const passwordHash = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.create({
    data: {
      email: 'demo@orga.app',
      passwordHash,
      name: 'Demo User',
    },
  });

  const accounts = await prisma.financeAccount.createMany({
    data: [
      { userId: user.id, name: 'Wallet', type: 'CASH', initialBalance: 500 },
      { userId: user.id, name: 'Nubank', type: 'CREDIT', initialBalance: 0 },
      { userId: user.id, name: 'Inter', type: 'BANK', initialBalance: 1500 },
    ],
  });

  const createdAccounts = await prisma.financeAccount.findMany({
    where: { userId: user.id },
  });

  const categories = await prisma.financeCategory.createMany({
    data: [
      { userId: user.id, name: 'Housing' },
      { userId: user.id, name: 'Food' },
      { userId: user.id, name: 'Transport' },
      { userId: user.id, name: 'Leisure' },
      { userId: user.id, name: 'Health' },
    ],
  });

  const createdCategories = await prisma.financeCategory.findMany({
    where: { userId: user.id },
  });

  const now = new Date();
  const transactionsData = Array.from({ length: 40 }).map((_, index) => {
    const occurredAt = new Date(now);
    occurredAt.setDate(occurredAt.getDate() - Math.floor(Math.random() * 90));

    const account = createdAccounts[index % createdAccounts.length];
    const category = createdCategories[index % createdCategories.length];
    const type =
      index % 4 === 0 ? TransactionType.INCOME : TransactionType.EXPENSE;
    const amount =
      type === TransactionType.INCOME
        ? Number((Math.random() * 1000 + 500).toFixed(2))
        : Number((Math.random() * 200 + 20).toFixed(2));

    return {
      userId: user.id,
      type,
      accountId: account.id,
      categoryId: category.id,
      amount,
      occurredAt,
      notes: `${type === TransactionType.INCOME ? 'Payment' : 'Expense'} #${index + 1}`,
      tags: type === TransactionType.INCOME ? ['income'] : ['expense'],
    };
  });

  await prisma.financeTransaction.createMany({ data: transactionsData });

  const tasksData = Array.from({ length: 20 }).map((_, index) => {
    const createdAt = new Date(now);
    createdAt.setDate(createdAt.getDate() - index);
    const completed = index % 2 === 0;

    return {
      userId: user.id,
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
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
