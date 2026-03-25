import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { ChatbotService } from './chatbot.service.js';
import { ChatbotConfigService } from './chatbot-config.service.js';
import { ChatbotAnalyticsService, type SessionStats } from './chatbot-analytics.service.js';
import { UpdateChatbotConfigDto } from './dto/update-chatbot-config.dto.js';
import { SendMessageDto } from './dto/send-message.dto.js';

@ApiTags('Chatbot')
@ApiBearerAuth()
@Controller('chatbot')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ChatbotAdminController {
  constructor(
    private readonly chatbotService: ChatbotService,
    private readonly configService: ChatbotConfigService,
    private readonly analyticsService: ChatbotAnalyticsService,
  ) {}

  // ═══════════════════════════════════════════════════════════
  //  CONFIG — Admin only
  // ═══════════════════════════════════════════════════════════

  @Get('config')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getConfig() {
    return this.configService.getAll();
  }

  @Get('config/:category')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getConfigByCategory(@Param('category') category: string) {
    return this.configService.getByCategory(category);
  }

  @Put('config')
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  async updateConfig(@Body() dto: UpdateChatbotConfigDto) {
    return this.configService.bulkUpsert(dto.configs);
  }

  @Post('config/seed')
  @HttpCode(200)
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  async seedDefaults() {
    const count = await this.configService.seedDefaults();
    return { seeded: count };
  }

  // ═══════════════════════════════════════════════════════════
  //  ANALYTICS — Admin only
  // ═══════════════════════════════════════════════════════════

  @Get('analytics')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getAnalytics(
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<SessionStats> {
    return this.analyticsService.getSessionStats({ from, to });
  }

  @Get('analytics/questions')
  @CheckPermissions({ module: 'chatbot', action: 'view' })
  async getMostAskedQuestions(@Query('limit') limit?: string) {
    return this.analyticsService.getMostAskedQuestions(
      limit ? parseInt(limit, 10) : 10,
    );
  }

  // ═══════════════════════════════════════════════════════════
  //  LIVE CHAT — Staff sends message to handed-off session
  // ═══════════════════════════════════════════════════════════

  @Post('sessions/:id/staff-messages')
  @CheckPermissions({ module: 'chatbot', action: 'edit' })
  async sendStaffMessage(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.chatbotService.sendStaffMessage(id, user.id, dto.content);
    return { success: true, data };
  }
}
