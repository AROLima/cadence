import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { createApiResponse } from '../common/dto/api-response.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { UpdateMeDto } from './dto/update-me.dto';
import { MeService } from './me.service';

@ApiTags('Me')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('me')
export class MeController {
  constructor(private readonly meService: MeService) {}

  @Get()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiOkResponse({ description: 'Returns the authenticated user profile.' })
  async profile(@CurrentUser('id') userId: number) {
    const profile = await this.meService.getProfile(userId);
    return createApiResponse(profile);
  }

  @Patch()
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateMeDto })
  @ApiOkResponse({ description: 'Returns the updated profile.' })
  async update(@CurrentUser('id') userId: number, @Body() dto: UpdateMeDto) {
    const profile = await this.meService.updateProfile(userId, dto);
    return createApiResponse(profile);
  }
}
