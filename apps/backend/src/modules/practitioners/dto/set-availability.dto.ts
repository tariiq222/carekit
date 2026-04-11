import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AvailabilitySlotDto {
  @ApiProperty({ description: 'Day of week: 0=Sunday, 6=Saturday', minimum: 0, maximum: 6, example: 1 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ description: 'Start time in HH:mm format', example: '09:00' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @ApiProperty({ description: 'End time in HH:mm format', example: '17:00' })
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:mm format' })
  endTime!: string;

  @ApiPropertyOptional({ description: 'Whether this availability slot is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  // Multi-branch: null = available at all branches. Non-null = branch-scoped.
  @ApiPropertyOptional({
    description: 'Branch ID. Null/omitted = available at all branches.',
    format: 'uuid',
    nullable: true,
  })
  @IsOptional()
  branchId?: string;
}

export class SetAvailabilityDto {
  @ApiProperty({
    isArray: true,
    type: () => AvailabilitySlotDto,
    description: 'Full availability schedule — replaces existing schedule',
  })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => AvailabilitySlotDto)
  schedule!: AvailabilitySlotDto[];
}
