import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto.js';

export class GroupSessionQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }: { value: string }) => value?.trim())
  search?: string;

  @IsOptional()
  @IsUUID()
  practitionerId?: string;

  @IsOptional()
  @IsEnum(['open', 'confirmed', 'full', 'completed', 'cancelled'] as const)
  status?: string;

  @IsOptional()
  @IsEnum(['published', 'draft'] as const)
  visibility?: string;
}
