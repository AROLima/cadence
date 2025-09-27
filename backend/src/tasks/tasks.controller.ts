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
import { CreateCommentDto } from './dto/create-comment.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { TaskQueryDto } from './dto/task-query.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TasksService } from './tasks.service';

@ApiTags('Tasks')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ summary: 'List tasks' })
  @ApiOkResponse({
    description:
      'Returns a paginated list of tasks that match the provided filters.',
  })
  async list(
    @CurrentUser('id') userId: number,
    @Query(new PaginationPipe({ defaultPageSize: 20, maxPageSize: 100 }))
    pagination: PaginationParams,
    @Query() query: TaskQueryDto,
  ) {
    const result = await this.tasksService.listTasks(userId, pagination, query);
    return createApiResponse(result);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get task by id' })
  @ApiParam({ name: 'id', description: 'Task identifier', type: Number })
  @ApiOkResponse({ description: 'Returns a single task.' })
  async detail(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const task = await this.tasksService.getTaskById(userId, id);
    return createApiResponse(task);
  }

  @Post()
  @ApiOperation({ summary: 'Create a new task' })
  @ApiCreatedResponse({ description: 'Task created successfully.' })
  async create(@CurrentUser('id') userId: number, @Body() dto: CreateTaskDto) {
    const task = await this.tasksService.createTask(userId, dto);
    return createApiResponse(task);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an existing task' })
  @ApiParam({ name: 'id', description: 'Task identifier', type: Number })
  @ApiOkResponse({ description: 'Task updated successfully.' })
  async update(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTaskDto,
  ) {
    const task = await this.tasksService.updateTask(userId, id, dto);
    return createApiResponse(task);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a task' })
  @ApiParam({ name: 'id', description: 'Task identifier', type: Number })
  @ApiOkResponse({ description: 'Task deleted successfully.' })
  async remove(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    await this.tasksService.deleteTask(userId, id);
    return createApiResponse({ message: 'Task deleted' });
  }

  @Post(':id/tags/:tagId')
  @ApiOperation({ summary: 'Assign a tag to a task' })
  @ApiParam({ name: 'id', description: 'Task identifier', type: Number })
  @ApiParam({ name: 'tagId', description: 'Tag identifier', type: Number })
  @ApiOkResponse({ description: 'Updated task with the tag attached.' })
  async attachTag(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) taskId: number,
    @Param('tagId', ParseIntPipe) tagId: number,
  ) {
    const task = await this.tasksService.addTagToTask(userId, taskId, tagId);
    return createApiResponse(task);
  }

  @Delete(':id/tags/:tagId')
  @ApiOperation({ summary: 'Remove a tag from a task' })
  @ApiParam({ name: 'id', description: 'Task identifier', type: Number })
  @ApiParam({ name: 'tagId', description: 'Tag identifier', type: Number })
  @ApiOkResponse({ description: 'Updated task with the tag removed.' })
  async detachTag(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) taskId: number,
    @Param('tagId', ParseIntPipe) tagId: number,
  ) {
    const task = await this.tasksService.removeTagFromTask(
      userId,
      taskId,
      tagId,
    );
    return createApiResponse(task);
  }

  @Get(':id/comments')
  @ApiOperation({ summary: 'List comments for a task' })
  @ApiParam({ name: 'id', description: 'Task identifier', type: Number })
  @ApiOkResponse({ description: 'Returns comments for the given task.' })
  async comments(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
  ) {
    const comments = await this.tasksService.listComments(userId, id);
    return createApiResponse(comments);
  }

  @Post(':id/comments')
  @ApiOperation({ summary: 'Create a comment on a task' })
  @ApiParam({ name: 'id', description: 'Task identifier', type: Number })
  @ApiBody({ type: CreateCommentDto })
  @ApiCreatedResponse({ description: 'Comment created successfully.' })
  async addComment(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCommentDto,
  ) {
    const comment = await this.tasksService.createComment(userId, id, dto);
    return createApiResponse(comment);
  }

  @Post(':id/subtasks')
  @ApiOperation({ summary: 'Create a subtask' })
  @ApiParam({ name: 'id', description: 'Parent task identifier', type: Number })
  @ApiCreatedResponse({ description: 'Subtask created successfully.' })
  async addSubtask(
    @CurrentUser('id') userId: number,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateTaskDto,
  ) {
    const task = await this.tasksService.createSubtask(userId, id, dto);
    return createApiResponse(task);
  }
}
