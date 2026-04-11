import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BreakSlotDto {
  @ApiProperty({ description: 'Day of week: 0=Sunday, 6=Saturday', minimum: 0, maximum: 6, example: 1 })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @ApiProperty({ description: 'Break start time in HH:mm format', example: '13:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @ApiProperty({ description: 'Break end time in HH:mm format', example: '14:00' })
  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:mm format' })
  endTime!: string;
}

export class SetBreaksDto {
  @ApiProperty({
    isArray: true,
    type: () => BreakSlotDto,
    description: 'Full breaks schedule — replaces existing breaks',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakSlotDto)
  breaks!: BreakSlotDto[];
}
