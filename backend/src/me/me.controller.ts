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
import { UpdateMySettingsDto } from './dto/update-my-settings.dto';

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

  @Get('settings')
  @ApiOperation({ summary: 'Get my settings/preferences' })
  @ApiOkResponse({ description: 'Returns merged settings with defaults.' })
  async getSettings(@CurrentUser('id') userId: number) {
    const settings = await this.meService.getMySettings(userId);
    return createApiResponse(settings);
  }

  @Patch('settings')
  @ApiOperation({ summary: 'Update my settings/preferences' })
  @ApiBody({ type: UpdateMySettingsDto })
  @ApiOkResponse({ description: 'Returns updated merged settings.' })
  async updateSettings(
    @CurrentUser('id') userId: number,
    @Body() dto: UpdateMySettingsDto,
  ) {
    const settings = await this.meService.updateMySettings(userId, dto);
    return createApiResponse(settings);
  }
}
