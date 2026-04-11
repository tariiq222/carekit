import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompleteBookingDto {
  @ApiPropertyOptional({ description: 'Practitioner notes on appointment completion', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  completionNotes?: string;
}
