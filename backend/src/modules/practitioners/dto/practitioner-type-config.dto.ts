import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class PractitionerDurationOptionInput {
  @IsString()
  @MinLength(1)
  label!: string;

  @IsOptional()
  @IsString()
  labelAr?: string;

  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number;

  @IsInt()
  @Min(0)
  price!: number; // halalat

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class PractitionerTypeConfigDto {
  @IsEnum(['in_person', 'online'])
  bookingType!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number | null; // null = use service default

  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  duration?: number | null; // null = use service default

  @IsOptional()
  @IsBoolean()
  useCustomOptions?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PractitionerDurationOptionInput)
  durationOptions?: PractitionerDurationOptionInput[];
}
