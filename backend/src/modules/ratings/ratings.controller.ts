import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../auth/guards/permissions.guard.js';
import { CheckPermissions } from '../auth/decorators/check-permissions.decorator.js';
import { RatingsService } from './ratings.service.js';

interface AuthenticatedRequest {
  user: { id: string };
}

@ApiTags('Ratings')
@Controller('ratings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @CheckPermissions({ module: 'ratings', action: 'create' })
  @ApiOperation({ summary: 'Submit a rating for a completed booking' })
  create(
    @Body() body: { bookingId: string; stars: number; comment?: string },
    @Request() req: AuthenticatedRequest,
  ) {
    return this.ratingsService.create({
      bookingId: body.bookingId,
      patientId: req.user.id,
      stars: body.stars,
      comment: body.comment,
    });
  }

  @Get('practitioner/:practitionerId')
  @CheckPermissions({ module: 'ratings', action: 'view' })
  @ApiOperation({ summary: 'Get all ratings for a practitioner' })
  findByPractitioner(
    @Param('practitionerId') practitionerId: string,
    @Query('page') page?: string,
    @Query('perPage') perPage?: string,
  ) {
    return this.ratingsService.findByPractitioner(practitionerId, {
      page: page ? parseInt(page) : undefined,
      perPage: perPage ? parseInt(perPage) : undefined,
    });
  }

  @Get('booking/:bookingId')
  @CheckPermissions({ module: 'ratings', action: 'view' })
  @ApiOperation({ summary: 'Get rating for a specific booking' })
  findByBooking(@Param('bookingId') bookingId: string) {
    return this.ratingsService.findByBooking(bookingId);
  }
}
