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
    // Fetch the current user by id; throws 404 if not found
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toView(user);
  }

  async updateProfile(userId: number, dto: UpdateMeDto): Promise<MeView> {
    // First ensure user exists so we can validate current password below
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updateData: Record<string, unknown> = {};

    if (dto.name) {
      updateData.name = dto.name;
    }

    if (dto.password) {
      // If changing password, require the current password and verify it
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

      // Store only the hash, never the raw password
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
    // Read the row stored under the composite unique key (userId + key)
    // We use key = 'preferences' to hold the entire MySettings object as JSON
    const userSetting = (this.prisma as unknown as Record<string, any>)[
      'userSetting'
    ] as {
      findUnique: (args: {
        where: { userId_key: { userId: number; key: string } };
      }) => Promise<{ value: unknown } | null>;
    };
    const row = await userSetting.findUnique({
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
    const userSetting = (this.prisma as unknown as Record<string, any>)[
      'userSetting'
    ] as {
      findUnique: (args: {
        where: { userId_key: { userId: number; key: string } };
      }) => Promise<{ value: unknown } | null>;
      upsert: (args: {
        where: { userId_key: { userId: number; key: string } };
        update: { value: object };
        create: { userId: number; key: string; value: object };
      }) => Promise<unknown>;
    };
    const existing = await userSetting.findUnique({
      where: { userId_key: { userId, key: 'preferences' } },
    });
    const current = (existing?.value as Partial<MySettings>) ?? {};

    // Merge shallow for top-level, nested for notifications
    // Shallow merge top-level, but merge the nested notifications object
    const next: Partial<MySettings> = {
      ...current,
      ...patch,
      notifications: {
        ...(current.notifications ?? {}),
        ...(patch.notifications ?? {}),
      } as MySettings['notifications'],
    };

    // Upsert so we create the row on first save and update it thereafter
    await userSetting.upsert({
      where: { userId_key: { userId, key: 'preferences' } },
      update: { value: next as unknown as object },
      create: { userId, key: 'preferences', value: next as unknown as object },
    });

    return this.mergeSettings(next);
  }

  private mergeSettings(partial: Partial<MySettings>): MySettings {
    // Merge provided values onto defaults; notifications merged deeply
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
