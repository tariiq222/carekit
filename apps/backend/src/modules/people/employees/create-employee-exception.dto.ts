import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateEmployeeExceptionDto {
  @ApiProperty({ description: 'Start date of the exception (ISO 8601)', example: '2026-05-01T09:00:00.000Z' })
  @IsDateString()
  startDate!: string;

  @ApiProperty({ description: 'End date of the exception (ISO 8601)', example: '2026-05-07T09:00:00.000Z' })
  @IsDateString()
  endDate!: string;

  @ApiPropertyOptional({ description: 'Reason for the exception (e.g. annual leave)', example: 'Annual vacation' })
  @IsOptional()
  @IsString()
  reason?: string;
}
