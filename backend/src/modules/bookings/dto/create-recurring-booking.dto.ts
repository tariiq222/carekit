import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRecurringBookingDto {
  @ApiProperty({ description: 'Practitioner UUID', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  practitionerId!: string;

  @ApiProperty({ description: 'Service UUID', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ enum: ['in_person', 'online'], description: 'Booking type' })
  @IsEnum(['in_person', 'online'])
  @IsNotEmpty()
  type!: 'in_person' | 'online';

  @ApiProperty({ description: 'First booking date in YYYY-MM-DD format', example: '2026-04-01' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
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

  @ApiPropertyOptional({ description: 'Admin only: book on behalf of a patient by their user ID', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  patientId?: string;

  @ApiPropertyOptional({ description: 'Branch UUID for branch-scoped booking', format: 'uuid' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({
    enum: ['daily', 'every_2_days', 'every_3_days', 'weekly', 'biweekly', 'monthly'],
    description: 'Recurrence frequency',
  })
  @IsEnum([
    'daily',
    'every_2_days',
    'every_3_days',
    'weekly',
    'biweekly',
    'monthly',
  ])
  @IsNotEmpty()
  repeatEvery!:
    | 'daily'
    | 'every_2_days'
    | 'every_3_days'
    | 'weekly'
    | 'biweekly'
    | 'monthly';

  @ApiProperty({ description: 'Total number of recurrences (2–52)', minimum: 2, maximum: 52, example: 4 })
  @IsInt()
  @Min(2)
  @Max(52)
  repeatCount!: number;
}
