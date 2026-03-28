import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BookingType } from '@prisma/client';

export class CreateBookingDto {
  @ApiProperty({ description: 'Practitioner ID' })
  @IsUUID()
  @IsNotEmpty()
  practitionerId!: string;

  @ApiProperty({ description: 'Service ID' })
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ enum: BookingType, description: 'Booking type (in_person, online, walk_in)' })
  @IsEnum(BookingType)
  @IsNotEmpty()
  type!: BookingType;

  @ApiProperty({ description: 'Booking date in YYYY-MM-DD format', example: '2026-04-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be in YYYY-MM-DD format' })
  date!: string;

  @ApiProperty({ description: 'Start time in HH:mm format', example: '10:00' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @ApiPropertyOptional({ description: 'Patient notes for the practitioner', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ description: 'Admin only: book on behalf of a patient by their user ID' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Branch ID for branch-scoped booking settings, dashboards, and reporting' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ description: 'Duration option ID if selecting a specific duration/price option' })
  @IsOptional()
  @IsUUID()
  durationOptionId?: string;

  @ApiPropertyOptional({ description: 'Skip payment — pay at clinic (cash/POS). Admin only.' })
  @IsOptional()
  @IsBoolean()
  payAtClinic?: boolean;

  /**
   * Internal: Set by BookingRecurringService to atomically link booking to its series.
   * @IsOptional ensures forbidNonWhitelisted does not reject this property when
   * present on the class instance but absent from the HTTP request body.
   */
  @IsOptional()
  @IsUUID()
  recurringGroupId?: string;
}
