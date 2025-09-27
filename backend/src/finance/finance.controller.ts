import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { createApiResponse } from '../common/dto/api-response.dto';
import { PaginationParams } from '../common/dto/pagination.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PaginationPipe } from '../common/pipes/pagination.pipe';
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
import { FinanceService } from './finance.service';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  // Accounts
  @Get('accounts')
  @ApiOperation({ summary: 'List accounts' })
  @ApiOkResponse({
    description: 'Returns all accounts for the authenticated user.',
  })
  async listAccounts(@CurrentUser('id') userId: number) {
    const accounts = await this.financeService.listAccounts(userId);
    return createApiResponse(accounts);
  }

  @Get('accounts/:id')
  @ApiOperation({ summary: 'Get account by id' })
  @ApiParam({ name: 'id', description: 'Account identifier', type: Number })
  @ApiOkResponse({ description: 'Returns the requested account.' })
  async getAccount(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const account = await this.financeService.getAccount(userId, id);
    return createApiResponse(account);
  }

  @Post('accounts')
  @ApiOperation({ summary: 'Create an account' })
  @ApiBody({ type: CreateAccountDto })
  @ApiCreatedResponse({ description: 'Account created successfully.' })
  async createAccount(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateAccountDto,
  ) {
    const account = await this.financeService.createAccount(userId, dto);
    return createApiResponse(account);
  }

  @Patch('accounts/:id')
  @ApiOperation({ summary: 'Update an account' })
  @ApiParam({ name: 'id', description: 'Account identifier', type: Number })
  @ApiOkResponse({ description: 'Account updated successfully.' })
  async updateAccount(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountDto,
  ) {
    const account = await this.financeService.updateAccount(userId, id, dto);
    return createApiResponse(account);
  }

  @Delete('accounts/:id')
  @ApiOperation({ summary: 'Delete an account' })
  @ApiParam({ name: 'id', description: 'Account identifier', type: Number })
  @ApiOkResponse({ description: 'Account deleted successfully.' })
  async deleteAccount(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.financeService.deleteAccount(userId, id);
    return createApiResponse({ message: 'Account deleted' });
  }

  // Categories
  @Get('categories')
  @ApiOperation({ summary: 'List categories' })
  @ApiOkResponse({
    description: 'Returns all categories for the authenticated user.',
  })
  async listCategories(@CurrentUser('id') userId: number) {
    const categories = await this.financeService.listCategories(userId);
    return createApiResponse(categories);
  }

  @Get('categories/tree')
  @ApiOperation({ summary: 'Get category tree' })
  @ApiOkResponse({
    description: 'Returns categories organised as a hierarchy.',
  })
  async categoryTree(@CurrentUser('id') userId: number) {
    const tree = await this.financeService.getCategoryTree(userId);
    return createApiResponse(tree);
  }

  @Post('categories')
  @ApiOperation({ summary: 'Create a category' })
  @ApiBody({ type: CreateCategoryDto })
  @ApiCreatedResponse({ description: 'Category created successfully.' })
  async createCategory(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateCategoryDto,
  ) {
    const category = await this.financeService.createCategory(userId, dto);
    return createApiResponse(category);
  }

  @Patch('categories/:id')
  @ApiOperation({ summary: 'Update a category' })
  @ApiParam({ name: 'id', description: 'Category identifier', type: Number })
  @ApiOkResponse({ description: 'Category updated successfully.' })
  async updateCategory(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    const category = await this.financeService.updateCategory(userId, id, dto);
    return createApiResponse(category);
  }

  @Delete('categories/:id')
  @ApiOperation({ summary: 'Delete a category' })
  @ApiParam({ name: 'id', description: 'Category identifier', type: Number })
  @ApiOkResponse({ description: 'Category deleted successfully.' })
  async deleteCategory(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.financeService.deleteCategory(userId, id);
    return createApiResponse({ message: 'Category deleted' });
  }

  // Transactions
  @Get('transactions')
  @ApiOperation({ summary: 'List transactions' })
  @ApiOkResponse({ description: 'Returns a paginated list of transactions.' })
  async listTransactions(
    @CurrentUser('id') userId: number,
    @Query(new PaginationPipe({ defaultPageSize: 20, maxPageSize: 200 }))
    pagination: PaginationParams,
    @Query() query: TransactionQueryDto,
  ) {
    const { items, meta } = await this.financeService.listTransactions(
      userId,
      pagination,
      query,
    );
    return createApiResponse({ items, meta });
  }

  @Get('transactions/:id')
  @ApiOperation({ summary: 'Get transaction by id' })
  @ApiParam({ name: 'id', description: 'Transaction identifier', type: Number })
  @ApiOkResponse({ description: 'Returns the requested transaction.' })
  async getTransaction(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const transaction = await this.financeService.getTransaction(userId, id);
    return createApiResponse(transaction);
  }

  @Post('transactions')
  @ApiOperation({ summary: 'Create a transaction' })
  @ApiBody({ type: CreateTransactionDto })
  @ApiCreatedResponse({ description: 'Transaction created successfully.' })
  async createTransaction(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateTransactionDto,
  ) {
    const transaction = await this.financeService.createTransaction(
      userId,
      dto,
    );
    return createApiResponse(transaction);
  }

  @Patch('transactions/:id')
  @ApiOperation({ summary: 'Update a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction identifier', type: Number })
  @ApiOkResponse({ description: 'Transaction updated successfully.' })
  async updateTransaction(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTransactionDto,
  ) {
    const transaction = await this.financeService.updateTransaction(
      userId,
      id,
      dto,
    );
    return createApiResponse(transaction);
  }

  @Delete('transactions/:id')
  @ApiOperation({ summary: 'Delete a transaction' })
  @ApiParam({ name: 'id', description: 'Transaction identifier', type: Number })
  @ApiOkResponse({ description: 'Transaction deleted successfully.' })
  async deleteTransaction(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.financeService.deleteTransaction(userId, id);
    return createApiResponse({ message: 'Transaction deleted' });
  }

  // Budgets
  @Get('budgets')
  @ApiOperation({ summary: 'List budgets' })
  @ApiOkResponse({ description: 'Returns budgets for the authenticated user.' })
  async listBudgets(
    @CurrentUser('id') userId: number,
    @Query() query: BudgetQueryDto,
  ) {
    const budgets = await this.financeService.listBudgets(userId, query);
    return createApiResponse(budgets);
  }

  @Get('budgets/:id')
  @ApiOperation({ summary: 'Get budget by id' })
  @ApiParam({ name: 'id', description: 'Budget identifier', type: Number })
  @ApiOkResponse({ description: 'Returns the requested budget.' })
  async getBudget(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const budget = await this.financeService.getBudget(userId, id);
    return createApiResponse(budget);
  }

  @Post('budgets')
  @ApiOperation({ summary: 'Create a budget' })
  @ApiBody({ type: CreateBudgetDto })
  @ApiCreatedResponse({ description: 'Budget created successfully.' })
  async createBudget(
    @CurrentUser('id') userId: number,
    @Body() dto: CreateBudgetDto,
  ) {
    const budget = await this.financeService.createBudget(userId, dto);
    return createApiResponse(budget);
  }

  @Patch('budgets/:id')
  @ApiOperation({ summary: 'Update a budget' })
  @ApiParam({ name: 'id', description: 'Budget identifier', type: Number })
  @ApiOkResponse({ description: 'Budget updated successfully.' })
  async updateBudget(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBudgetDto,
  ) {
    const budget = await this.financeService.updateBudget(userId, id, dto);
    return createApiResponse(budget);
  }

  @Delete('budgets/:id')
  @ApiOperation({ summary: 'Delete a budget' })
  @ApiParam({ name: 'id', description: 'Budget identifier', type: Number })
  @ApiOkResponse({ description: 'Budget deleted successfully.' })
  async deleteBudget(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.financeService.deleteBudget(userId, id);
    return createApiResponse({ message: 'Budget deleted' });
  }
}
