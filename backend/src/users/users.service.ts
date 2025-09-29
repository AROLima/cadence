import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role, User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PaginationMeta, PaginationParams } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';

export interface UserView {
  id: number;
  email: string;
  name: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * UsersService
 * - Provides admin-side operations over User entities
 * - Demonstrates pagination, search, and Prisma error handling
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async listUsers(pagination: PaginationParams, filters: UserQueryDto) {
    const where: Prisma.UserWhereInput = {};

    if (filters.search) {
      where.OR = [
        { email: { contains: filters.search, mode: 'insensitive' } },
        { name: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    if (filters.role) {
      where.role = filters.role;
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip: pagination.skip,
        take: pagination.take,
        where,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    const items = users.map((user) => this.toUserView(user));
    const meta: PaginationMeta = {
      page: pagination.page,
      pageSize: pagination.pageSize,
      total,
      pageCount: Math.max(1, Math.ceil(total / pagination.pageSize)),
    };

    return { items, meta };
  }

  async findById(id: number): Promise<UserView> {
    const user = await this.prisma.user.findUnique({ where: { id } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toUserView(user);
  }

  async createUser(dto: CreateUserDto): Promise<UserView> {
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    try {
      const user = await this.prisma.user.create({
        data: {
          email: dto.email,
          passwordHash: hashedPassword,
          name: dto.name,
          role: dto.role ?? Role.USER,
        },
      });
      return this.toUserView(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async updateUser(id: number, dto: UpdateUserDto): Promise<UserView> {
    await this.ensureUserExists(id);

    const updateData: Prisma.UserUpdateInput = {};

    if (dto.email) updateData.email = dto.email;
    if (dto.name) updateData.name = dto.name;
    if (dto.role) updateData.role = dto.role;

    if (dto.password) {
      updateData.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    try {
      const user = await this.prisma.user.update({
        where: { id },
        data: updateData,
      });
      return this.toUserView(user);
    } catch (error) {
      this.handlePrismaError(error);
    }
  }

  async deleteUser(id: number): Promise<void> {
    await this.ensureUserExists(id);
    await this.prisma.user.delete({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  private toUserView(user: User): UserView {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  private async ensureUserExists(id: number): Promise<void> {
    const exists = await this.prisma.user.count({ where: { id } });
    if (!exists) {
      throw new NotFoundException('User not found');
    }
  }

  private handlePrismaError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        throw new ConflictException(
          'User with provided unique field already exists',
        );
      }
    }

    throw error;
  }
}
