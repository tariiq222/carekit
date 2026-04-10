import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RescheduleBookingDto {
  @ApiPropertyOptional({ description: 'New booking date in YYYY-MM-DD format', example: '2026-05-10' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'date must be in YYYY-MM-DD format',
  })
  date?: string;

  @ApiPropertyOptional({ description: 'New start time in HH:mm format', example: '14:30' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime?: string;
}
