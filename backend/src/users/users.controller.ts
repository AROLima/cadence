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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { createApiResponse } from '../common/dto/api-response.dto';
import { PaginationParams } from '../common/dto/pagination.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { PaginationPipe } from '../common/pipes/pagination.pipe';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserQueryDto } from './dto/user-query.dto';
import { UsersService } from './users.service';

@ApiTags('Users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'List users' })
  @ApiOkResponse({ description: 'Returns a paginated list of users.' })
  async list(
    @Query(new PaginationPipe({ defaultPageSize: 20, maxPageSize: 100 }))
    pagination: PaginationParams,
    @Query() query: UserQueryDto,
  ) {
    const { items, meta } = await this.usersService.listUsers(
      pagination,
      query,
    );
    return createApiResponse({ items, meta });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get user by id' })
  @ApiParam({ name: 'id', description: 'User identifier', type: Number })
  @ApiOkResponse({ description: 'Returns a single user.' })
  async detail(@Param('id', ParseIntPipe) id: number) {
    const user = await this.usersService.findById(id);
    return createApiResponse(user);
  }

  @Post()
  @ApiOperation({ summary: 'Create a user' })
  @ApiCreatedResponse({ description: 'User created successfully.' })
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.createUser(dto);
    return createApiResponse(user);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user' })
  @ApiParam({ name: 'id', description: 'User identifier', type: Number })
  @ApiOkResponse({ description: 'User updated successfully.' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUserDto,
  ) {
    const user = await this.usersService.updateUser(id, dto);
    return createApiResponse(user);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user' })
  @ApiParam({ name: 'id', description: 'User identifier', type: Number })
  @ApiOkResponse({ description: 'User deleted successfully.' })
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.usersService.deleteUser(id);
    return createApiResponse({ message: 'User deleted' });
  }
}
