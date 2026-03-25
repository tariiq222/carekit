import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DurationOptionDto {
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

export class SetDurationOptionsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DurationOptionDto)
  options!: DurationOptionDto[];
}
