import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export const FIELD_TYPES = [
  'text',
  'textarea',
  'number',
  'radio',
  'checkbox',
  'select',
  'date',
  'rating',
  'file',
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

export enum ConditionOperator {
  equals = 'equals',
  not_equals = 'not_equals',
  contains = 'contains',
}

export class FieldConditionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  fieldId!: string;

  @ApiProperty({ enum: ConditionOperator })
  @IsEnum(ConditionOperator)
  operator!: ConditionOperator;

  @ApiProperty()
  @IsString()
  value!: string;
}

export class IntakeFieldDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  labelAr!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  labelEn!: string;

  @ApiProperty({ enum: FIELD_TYPES })
  @IsString()
  @IsIn(FIELD_TYPES)
  fieldType!: FieldType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => FieldConditionDto)
  condition?: FieldConditionDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class SetFieldsDto {
  @ApiProperty({ type: [IntakeFieldDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntakeFieldDto)
  fields!: IntakeFieldDto[];
}
