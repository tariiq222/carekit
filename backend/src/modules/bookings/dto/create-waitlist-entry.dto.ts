import {
  IsString,
  IsUUID,
  IsOptional,
  IsDateString,
  MaxLength,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWaitlistEntryDto {
  @ApiProperty({
    description: 'UUID of the service to waitlist for',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'serviceId must be a valid UUID' })
  serviceId: string;

  @ApiPropertyOptional({
    description: 'UUID of the preferred practitioner',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  @IsOptional()
  @IsUUID('4', { message: 'practitionerId must be a valid UUID' })
  practitionerId?: string;

  @ApiPropertyOptional({
    description: 'Preferred date in ISO format',
    example: '2026-04-15',
  })
  @IsOptional()
  @IsDateString({}, { message: 'preferredDate must be a valid ISO date string' })
  preferredDate?: string;

  @ApiPropertyOptional({
    description: 'Preferred start time in HH:mm format',
    example: '09:00',
  })
  @IsOptional()
  @IsString({ message: 'preferredTimeStart must be a string' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Must be HH:mm format',
  })
  preferredTimeStart?: string;

  @ApiPropertyOptional({
    description: 'Preferred end time in HH:mm format',
    example: '11:00',
  })
  @IsOptional()
  @IsString({ message: 'preferredTimeEnd must be a string' })
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: 'Must be HH:mm format',
  })
  preferredTimeEnd?: string;

  @ApiPropertyOptional({
    description: 'Additional notes for the waitlist entry',
    example: 'Prefers morning slots',
    maxLength: 500,
  })
  @IsOptional()
  @IsString({ message: 'notes must be a string' })
  @MaxLength(500, { message: 'notes must be at most 500 characters' })
  notes?: string;

  @ApiPropertyOptional({
    description: 'UUID of the preferred branch',
    example: '770e8400-e29b-41d4-a716-446655440002',
  })
  @IsOptional()
  @IsUUID('4', { message: 'branchId must be a valid UUID' })
  branchId?: string;
}
