import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { UpsertConfigItemDto } from './upsert-config-item.dto.js';

export class UpdateConfigDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => UpsertConfigItemDto)
  configs!: UpsertConfigItemDto[];
}
