import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum FormScopeDto {
  global = 'global',
  service = 'service',
  practitioner = 'practitioner',
  branch = 'branch',
}

export enum FormTypeDto {
  pre_booking = 'pre_booking',
  pre_session = 'pre_session',
  post_session = 'post_session',
  registration = 'registration',
}

export class CreateIntakeFormDto {
  @ApiProperty({ example: 'استبيان ما قبل الجلسة' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameAr!: string;

  @ApiProperty({ example: 'Pre-Session Questionnaire' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameEn!: string;

  @ApiProperty({ enum: FormTypeDto })
  @IsEnum(FormTypeDto)
  type!: FormTypeDto;

  @ApiProperty({ enum: FormScopeDto })
  @IsEnum(FormScopeDto)
  scope!: FormScopeDto;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateIntakeFormDto) => o.scope === FormScopeDto.service)
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateIntakeFormDto) => o.scope === FormScopeDto.practitioner)
  @IsUUID()
  practitionerId?: string;

  @ApiPropertyOptional()
  @ValidateIf((o: CreateIntakeFormDto) => o.scope === FormScopeDto.branch)
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
