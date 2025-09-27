import { Module } from '@nestjs/common';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { TaskRecurrenceService } from './task-recurrence.service';

@Module({
  controllers: [TasksController],
  providers: [TasksService, TaskRecurrenceService],
  exports: [TasksService],
})
export class TasksModule {}
