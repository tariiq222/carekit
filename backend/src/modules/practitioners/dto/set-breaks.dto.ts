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

export class BreakSlotDto {
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek!: number;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'startTime must be in HH:mm format' })
  startTime!: string;

  @IsString()
  @Matches(/^\d{2}:\d{2}$/, { message: 'endTime must be in HH:mm format' })
  endTime!: string;
}

export class SetBreaksDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BreakSlotDto)
  breaks!: BreakSlotDto[];
}
