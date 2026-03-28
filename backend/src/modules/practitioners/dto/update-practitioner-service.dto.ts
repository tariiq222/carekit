import { Type } from 'class-transformer';
import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';
import { PractitionerTypeConfigDto } from './practitioner-type-config.dto.js';

export class UpdatePractitionerServiceDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  customDuration?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(['in_person', 'online'], { each: true })
  availableTypes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PractitionerTypeConfigDto)
  types?: PractitionerTypeConfigDto[];
}
