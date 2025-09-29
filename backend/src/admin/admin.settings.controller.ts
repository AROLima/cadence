import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { createApiResponse } from '../common/dto/api-response.dto';
import { UpdateAdminSettingsDto } from './dto/update-admin-settings.dto';

type AdminSettings = {
  companyName: string;
  defaultCurrency: string;
  fiscalMonthStart: number; // 1..12
};

const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  companyName: 'Cadence',
  defaultCurrency: 'USD',
  fiscalMonthStart: 1,
};

@ApiTags('Admin Settings')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly prisma: PrismaService) {}

  private async readSettings(): Promise<AdminSettings> {
    const appSetting = this.prisma.getAppSettingDelegate();
    const row = await appSetting.findUnique({
      where: { key: 'app' },
    });
    const stored = (row?.value as Partial<AdminSettings>) ?? {};
    return {
      ...DEFAULT_ADMIN_SETTINGS,
      ...stored,
    };
  }

  @Get()
  @ApiOperation({ summary: 'Get admin-level application settings' })
  async get() {
    const settings = await this.readSettings();
    const windowMs = Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000);
    const adminMax = Math.min(
      100,
      Number(process.env.RATE_LIMIT_ADMIN_MAX ?? 50),
    );
    const allowlist = (process.env.ADMIN_ALLOWLIST || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return createApiResponse({
      settings,
      rateLimit: { windowMs, adminMax },
      allowlist,
    });
  }

  @Patch()
  @ApiOperation({ summary: 'Update admin-level application settings' })
  async patch(@Body() dto: UpdateAdminSettingsDto) {
    const current = await this.readSettings();
    const next: AdminSettings = {
      ...current,
      ...dto,
    };
    const appSetting = this.prisma.getAppSettingDelegate();
    await appSetting.upsert({
      where: { key: 'app' },
      update: { value: next as unknown as object },
      create: { key: 'app', value: next as unknown as object },
    });
    return createApiResponse(next);
  }
}
