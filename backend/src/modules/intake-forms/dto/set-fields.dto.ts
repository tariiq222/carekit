import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'select',
  'checkbox',
  'date',
  'time',
  'static_text',
] as const;

export class IntakeFieldDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  labelAr!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  labelEn!: string;

  @IsString()
  @IsIn(FIELD_TYPES)
  fieldType!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class SetFieldsDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntakeFieldDto)
  fields!: IntakeFieldDto[];
}
