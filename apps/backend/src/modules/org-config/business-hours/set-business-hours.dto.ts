import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsInt, IsString, Matches, Max, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

const TIME_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export class BusinessHourSlotDto {
  @IsInt() @Min(0) @Max(6) dayOfWeek!: number;
  @IsString() @Matches(TIME_REGEX, { message: 'startTime must be HH:mm' }) startTime!: string;
  @IsString() @Matches(TIME_REGEX, { message: 'endTime must be HH:mm' }) endTime!: string;
  @IsBoolean() isOpen!: boolean;
}

export class SetBusinessHoursDto {
  @IsString() branchId!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(7)
  @ValidateNested({ each: true }) @Type(() => BusinessHourSlotDto)
  schedule!: BusinessHourSlotDto[];
}
