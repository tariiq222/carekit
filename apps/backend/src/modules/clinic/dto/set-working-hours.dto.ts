import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class WorkingHourSlot {
  @ApiProperty({ description: 'Day of week (0=Sunday, 6=Saturday)' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ description: 'Start time in HH:mm format' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  startTime: string;

  @ApiProperty({ description: 'End time in HH:mm format' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/)
  endTime: string;

  @ApiProperty({ description: 'Whether this day is active' })
  @IsBoolean()
  isActive: boolean;
}

export class SetWorkingHoursDto {
  @ApiProperty({ type: [WorkingHourSlot] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHourSlot)
  hours: WorkingHourSlot[];
}
