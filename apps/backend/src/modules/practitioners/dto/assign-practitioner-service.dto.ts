import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PractitionerTypeConfigDto } from './practitioner-type-config.dto.js';

export class AssignPractitionerServiceDto {
  @ApiProperty({ description: 'Service ID to assign', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;

  @ApiPropertyOptional({
    description: 'Override duration in minutes for this practitioner',
    minimum: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  customDuration?: number;

  @ApiPropertyOptional({
    description: 'Buffer time in minutes before/after appointment',
    minimum: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  bufferMinutes?: number;

  @ApiProperty({
    type: [String],
    enum: ['in_person', 'online'],
    description: 'Booking types available for this practitioner-service link',
    example: ['in_person'],
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(['in_person', 'online'], { each: true })
  availableTypes!: string[];

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
