import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';
import {
  DEFAULT_MY_SETTINGS,
  type MySettings,
  type UpdateMySettingsDto,
} from './dto/update-my-settings.dto';

export interface MeView {
  id: number;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class MeService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: number): Promise<MeView> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toView(user);
  }

  async updateProfile(userId: number, dto: UpdateMeDto): Promise<MeView> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name) {
      updateData.name = dto.name;
    }

    if (dto.password) {
      if (!dto.currentPassword) {
        throw new BadRequestException(
          'Current password is required to set a new password',
        );
      }

      const matches = await bcrypt.compare(
        dto.currentPassword,
        user.passwordHash,
      );
      if (!matches) {
        throw new BadRequestException('Current password is incorrect');
      }

      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: updateData,
    });

    return this.toView(updated);
  }

  private toView(user: {
    id: number;
    email: string;
    name: string;
    role: Role;
    createdAt: Date;
    updatedAt: Date;
  }): MeView {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  async getMySettings(userId: number): Promise<MySettings> {
    const row = await this.prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: 'preferences' } },
    });
    const stored = (row?.value as Partial<MySettings>) ?? {};
    return this.mergeSettings(stored);
  }

  async updateMySettings(
    userId: number,
    patch: UpdateMySettingsDto,
  ): Promise<MySettings> {
    // Read current
    const existing = await this.prisma.userSetting.findUnique({
      where: { userId_key: { userId, key: 'preferences' } },
    });
    const current = (existing?.value as Partial<MySettings>) ?? {};

    // Merge shallow for top-level, nested for notifications
    const next: Partial<MySettings> = {
      ...current,
      ...patch,
      notifications: {
        ...(current.notifications ?? {}),
        ...(patch.notifications ?? {}),
      } as MySettings['notifications'],
    };

    await this.prisma.userSetting.upsert({
      where: { userId_key: { userId, key: 'preferences' } },
      update: { value: next as unknown as object },
      create: { userId, key: 'preferences', value: next as unknown as object },
    });

    return this.mergeSettings(next);
  }

  private mergeSettings(partial: Partial<MySettings>): MySettings {
    return {
      ...DEFAULT_MY_SETTINGS,
      ...partial,
      notifications: {
        ...DEFAULT_MY_SETTINGS.notifications,
        ...(partial.notifications ?? {}),
      },
    };
  }
}
