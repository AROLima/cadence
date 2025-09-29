import {
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { createApiResponse } from '../common/dto/api-response.dto';

@ApiTags('Admin Tools')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/tools')
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('revoke-refresh/:userId')
  @ApiOperation({ summary: 'Revoke all refresh tokens for a user' })
  async revoke(@Param('userId', ParseIntPipe) userId: number) {
    const res = await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return createApiResponse({ revoked: res.count });
  }

  @Post('reassign-transactions')
  @ApiOperation({
    summary: 'Reassign transactions from one account to another',
  })
  async reassign(
    @Body()
    body: {
      userId: number;
      fromAccountId: number;
      toAccountId: number;
    },
  ) {
    const { userId, fromAccountId, toAccountId } = body;
    const res = await this.prisma.financeTransaction.updateMany({
      where: { userId, accountId: fromAccountId },
      data: { accountId: toAccountId },
    });
    return createApiResponse({ moved: res.count });
  }

  @Post('recalc-balances')
  @ApiOperation({ summary: 'Recalculate balances per account (summary only)' })
  async recalc(@Body() body: { userId: number }) {
    const { userId } = body;
    const accounts = await this.prisma.financeAccount.findMany({
      where: { userId },
    });
    const txs = await this.prisma.financeTransaction.findMany({
      where: { userId },
    });
    const byAccount: Record<number, number> = {};
    for (const a of accounts) {
      byAccount[a.id] = Number(a.initialBalance);
    }
    for (const t of txs) {
      const amt = Number(t.amount);
      if (t.type === 'INCOME') byAccount[t.accountId] += amt;
      else if (t.type === 'EXPENSE') byAccount[t.accountId] -= amt;
      // Transfers are already represented with separate rows per account in this schema
    }
    const summary = Object.entries(byAccount).map(([accountId, balance]) => ({
      accountId: Number(accountId),
      balance,
    }));
    return createApiResponse({ accounts: summary });
  }
}
