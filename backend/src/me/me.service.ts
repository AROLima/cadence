import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateMeDto } from './dto/update-me.dto';

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
}
