import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { createApiResponse } from './common/dto/api-response.dto';
import { Public } from './common/decorators/public.decorator';

@ApiTags('Health')
@Controller()
export class AppController {
  @Public()
  @Get('health')
  health() {
    return createApiResponse({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  }
}
