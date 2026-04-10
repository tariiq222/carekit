import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CancelRejectDto {
  @ApiPropertyOptional({ description: 'Internal admin notes explaining rejection', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
