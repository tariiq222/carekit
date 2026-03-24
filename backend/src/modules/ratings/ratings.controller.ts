import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { PermissionsGuard } from '../../common/guards/permissions.guard.js';
import { CheckPermissions } from '../../common/decorators/check-permissions.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { RatingsService } from './ratings.service.js';
import { CreateRatingDto } from './dto/create-rating.dto.js';
import { uuidPipe } from '../../common/pipes/uuid.pipe.js';

@ApiTags('Ratings')
@ApiBearerAuth()
@Controller('ratings')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RatingsController {
  constructor(private readonly ratingsService: RatingsService) {}

  @Post()
  @CheckPermissions({ module: 'ratings', action: 'create' })
  @ApiOperation({ summary: 'Submit a rating for a completed booking' })
  create(
    @Body() dto: CreateRatingDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.ratingsService.create({
      bookingId: dto.bookingId,
      patientId: user.id,
      stars: dto.stars,
      comment: dto.comment,
    });
  }

  @Get('practitioner/:practitionerId')
  @CheckPermissions({ module: 'ratings', action: 'view' })
  @ApiOperation({ summary: 'Get all ratings for a practitioner' })
  findByPractitioner(
    @Param('practitionerId', uuidPipe) practitionerId: string,
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
  findByBooking(@Param('bookingId', uuidPipe) bookingId: string) {
    return this.ratingsService.findByBooking(bookingId);
  }
}
