import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { createApiResponse } from '../common/dto/api-response.dto';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class RateLimitDto {
  @IsInt()
  @Min(60_000)
  @Max(24 * 60 * 60 * 1000)
  windowMs!: number; // 1 minute .. 24 hours

  @IsInt()
  @Min(1)
  @Max(10_000)
  adminMax!: number; // max requests in window for /admin
}

class UpdateInfraDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => RateLimitDto)
  rateLimit?: RateLimitDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowlist?: string[]; // array of IPs
}

type InfraSettings = {
  rateLimit: { windowMs: number; adminMax: number };
  allowlist: string[];
};

const DEFAULT_INFRA: InfraSettings = {
  rateLimit: {
    windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
    adminMax: Math.min(100, Number(process.env.RATE_LIMIT_ADMIN_MAX ?? 50)),
  },
  allowlist: (process.env.ADMIN_ALLOWLIST || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
};

@ApiTags('Admin Infra')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('admin/infra')
export class AdminInfraController {
  constructor(private readonly prisma: PrismaService) {}

  private async read(): Promise<InfraSettings> {
    const appSetting = this.prisma.getAppSettingDelegate();
    const row = await appSetting.findUnique({ where: { key: 'infra' } });
    const stored = (row?.value as Partial<InfraSettings>) ?? {};
    return { ...DEFAULT_INFRA, ...stored };
  }

  @Get()
  @ApiOperation({ summary: 'Get infrastructure/security settings' })
  async get() {
    const data = await this.read();
    return createApiResponse(data);
  }

  @Patch()
  @ApiOperation({ summary: 'Update infrastructure/security settings' })
  async patch(@Body() dto: UpdateInfraDto) {
    const current = await this.read();
    const next: InfraSettings = {
      rateLimit: {
        windowMs: dto.rateLimit?.windowMs ?? current.rateLimit.windowMs,
        adminMax: dto.rateLimit?.adminMax ?? current.rateLimit.adminMax,
      },
      allowlist: dto.allowlist ?? current.allowlist,
    };
    const appSetting = this.prisma.getAppSettingDelegate();
    await appSetting.upsert({
      where: { key: 'infra' },
      update: { value: next as unknown as object },
      create: { key: 'infra', value: next as unknown as object },
    });
    return createApiResponse(next);
  }
}
