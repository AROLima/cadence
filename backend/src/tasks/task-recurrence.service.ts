import { Injectable } from '@nestjs/common';
import { TaskView } from './types/task-view.type';

@Injectable()
export class TaskRecurrenceService {
  expand(task: TaskView): TaskView[] {
    // Placeholder for recurrence expansion logic.
    return [task];
  }
}
