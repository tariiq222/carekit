import { IsBoolean, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { FormScopeDto, FormTypeDto } from './create-intake-form.dto.js';

export class ListIntakeFormsDto {
  @ApiPropertyOptional({ enum: FormScopeDto })
  @IsOptional()
  @IsEnum(FormScopeDto)
  scope?: FormScopeDto;

  @ApiPropertyOptional({ enum: FormTypeDto })
  @IsOptional()
  @IsEnum(FormTypeDto)
  type?: FormTypeDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  practitionerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: string }) => value === 'true')
  @IsBoolean()
  isActive?: boolean;
}
