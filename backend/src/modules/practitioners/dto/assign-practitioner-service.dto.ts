import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min, ValidateNested } from 'class-validator';
import { PractitionerTypeConfigDto } from './practitioner-type-config.dto.js';

export class AssignPractitionerServiceDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceClinic?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePhone?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceVideo?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  customDuration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(['clinic_visit', 'phone_consultation', 'video_consultation'], { each: true })
  availableTypes!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PractitionerTypeConfigDto)
  types?: PractitionerTypeConfigDto[];
}
