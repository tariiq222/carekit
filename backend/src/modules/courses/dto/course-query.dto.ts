import { IsString, IsUUID, IsEnum, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class CourseQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name (AR or EN)' })
  @IsString()
  @IsOptional()
  @Transform(({ value }: { value: string }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  practitionerId?: string;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'in_progress', 'completed', 'archived'] })
  @IsEnum(['draft', 'published', 'in_progress', 'completed', 'archived'] as const)
  @IsOptional()
  status?: 'draft' | 'published' | 'in_progress' | 'completed' | 'archived';

  @ApiPropertyOptional({ enum: ['in_person', 'online', 'hybrid'] })
  @IsEnum(['in_person', 'online', 'hybrid'] as const)
  @IsOptional()
  deliveryMode?: 'in_person' | 'online' | 'hybrid';

  @ApiPropertyOptional({ type: Boolean })
  @IsOptional()
  @Transform(({ value }: { value: string | boolean }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  isGroup?: boolean;
}
