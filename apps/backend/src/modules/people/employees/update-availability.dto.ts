import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AvailabilityWindow {
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsString() @Matches(/^\d{2}:\d{2}$/) startTime!: string;
  @IsString() @Matches(/^\d{2}:\d{2}$/) endTime!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class AvailabilityException {
  @IsDateString() startDate!: string;
  @IsDateString() endDate!: string;
  @IsOptional() @IsString() reason?: string;
}

export class UpdateAvailabilityDto {
  @IsArray() @ValidateNested({ each: true }) @Type(() => AvailabilityWindow) windows!: AvailabilityWindow[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AvailabilityException) exceptions?: AvailabilityException[];
}
