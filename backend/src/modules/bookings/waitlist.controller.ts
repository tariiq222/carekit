import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { WaitlistService } from './waitlist.service.js';
import { JoinWaitlistDto } from './dto/join-waitlist.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';
import { ApiStandardResponses } from '../../common/swagger/api-responses.decorator.js';

@ApiTags('Waitlist')
@ApiBearerAuth()
@Controller('bookings/waitlist')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/waitlist/my — Patient's own waitlist entries
  // ═══════════════════════════════════════════════════════════════

  @Get('my')
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: "List current patient's waitlist entries" })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async findMyEntries(@CurrentUser() user: { id: string }) {
    const data = await this.waitlistService.findMyEntries(user.id);
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  GET /bookings/waitlist — Admin: list all waitlist entries
  // ═══════════════════════════════════════════════════════════════

  @Get()
  @CheckPermissions({ module: 'bookings', action: 'view' })
  @ApiOperation({ summary: 'List all waitlist entries (admin view)' })
  @ApiQuery({ name: 'practitionerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async findAll(
    @Query('practitionerId') practitionerId?: string,
    @Query('status') status?: string,
  ) {
    const data = await this.waitlistService.findAll({
      practitionerId,
      status,
    });
    return { success: true, data };
  }

  // ═══════════════════════════════════════════════════════════════
  //  POST /bookings/waitlist — Join waitlist
  // ═══════════════════════════════════════════════════════════════

  @Post()
  @CheckPermissions({ module: 'bookings', action: 'create' })
  @ApiOperation({ summary: 'Join the waitlist for a practitioner' })
  @ApiResponse({ status: 201 })
  @ApiStandardResponses()
  async join(
    @Body() dto: JoinWaitlistDto,
    @CurrentUser() user: { id: string },
  ) {
    const data = await this.waitlistService.join(user.id, dto);
    return { success: true, data, message: 'Joined waitlist successfully' };
  }

  // ═══════════════════════════════════════════════════════════════
  //  DELETE /bookings/waitlist/:id — Leave waitlist
  // ═══════════════════════════════════════════════════════════════

  @Delete(':id')
  @CheckPermissions({ module: 'bookings', action: 'create' })
  @ApiOperation({ summary: 'Leave the waitlist (remove entry)' })
  @ApiParam({ name: 'id', description: 'Waitlist entry UUID' })
  @ApiResponse({ status: 200 })
  @ApiStandardResponses()
  async leave(
    @Param('id', uuidPipe) id: string,
    @CurrentUser() user: { id: string },
  ) {
    await this.waitlistService.leave(id, user.id);
    return { success: true, message: 'Left waitlist successfully' };
  }
}
