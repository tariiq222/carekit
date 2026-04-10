import { IsIn, IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
  @ApiPropertyOptional({ description: 'Session language', enum: ['ar', 'en'], example: 'ar' })
  @IsOptional()
  @IsString()
  @IsIn(['ar', 'en'])
  language?: string;
}
