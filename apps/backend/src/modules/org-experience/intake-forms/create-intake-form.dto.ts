import { ArrayMaxSize, IsArray, IsBoolean, IsEnum, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { IntakeFieldType } from '@prisma/client';

export class IntakeFieldInputDto {
  @IsString() @MaxLength(200) labelAr!: string;
  @IsOptional() @IsString() @MaxLength(200) labelEn?: string;
  @IsEnum(IntakeFieldType) fieldType!: IntakeFieldType;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsArray() @IsString({ each: true }) options?: string[];
  @IsOptional() @IsInt() @Min(0) position?: number;
}

export class CreateIntakeFormDto {
  @IsString() @MaxLength(200) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => IntakeFieldInputDto)
  fields?: IntakeFieldInputDto[];
}
