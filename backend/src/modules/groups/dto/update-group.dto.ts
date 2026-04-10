import { PartialType } from '@nestjs/swagger';
import { CreateGroupDto } from './create-group.dto.js';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsDateString } from 'class-validator';

export class UpdateGroupDto extends PartialType(CreateGroupDto) {
  @ApiPropertyOptional({ description: 'Due date for remaining amount after deposit' })
  @IsOptional()
  @IsDateString()
  remainingDueDate?: string;
}
