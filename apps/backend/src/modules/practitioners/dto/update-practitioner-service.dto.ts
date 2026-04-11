import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PractitionerTypeConfigDto } from './practitioner-type-config.dto.js';

export class UpdatePractitionerServiceDto {
  @ApiPropertyOptional({
    description: 'Override duration in minutes. Null removes override.',
    minimum: 1,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  customDuration?: number | null;

  @ApiPropertyOptional({
    description: 'Buffer time in minutes before/after appointment',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @ApiPropertyOptional({
    type: [String],
    enum: ['in_person', 'online'],
    description: 'Booking types available for this practitioner-service link',
  })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(['in_person', 'online'], { each: true })
  availableTypes?: string[];

  @ApiPropertyOptional({ description: 'Whether this assignment is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    isArray: true,
    type: () => PractitionerTypeConfigDto,
    description: 'Per-type pricing and duration config',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PractitionerTypeConfigDto)
  types?: PractitionerTypeConfigDto[];
}
