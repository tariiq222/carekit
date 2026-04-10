import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';
import { GroupStatus, DeliveryMode } from '@prisma/client';

export class GroupQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Search by name (AR/EN)' })
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by practitioner UUID' })
  @IsOptional()
  @IsUUID()
  practitionerId?: string;

  @ApiPropertyOptional({ description: 'Filter by status', enum: GroupStatus })
  @IsOptional()
  @IsEnum(GroupStatus)
  status?: GroupStatus;

  @ApiPropertyOptional({
    description: 'Filter by delivery mode',
    enum: DeliveryMode,
  })
  @IsOptional()
  @IsEnum(DeliveryMode)
  deliveryMode?: DeliveryMode;

  @ApiPropertyOptional({
    description: 'Filter by visibility: published or draft',
  })
  @IsOptional()
  @IsEnum(['published', 'draft'] as const)
  visibility?: string;
}
