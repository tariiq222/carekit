import { ArrayMinSize, IsArray, IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BookingType } from '@prisma/client';

export class DurationOptionInputDto {
  @IsOptional() @IsUUID() id?: string;
  @IsOptional() @IsEnum(BookingType) bookingType?: BookingType | null;
  @IsString() @MaxLength(100) label!: string;
  @IsString() @MaxLength(100) labelAr!: string;
  @IsInt() @Min(1) durationMins!: number;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class SetDurationOptionsDto {
  @IsArray() @ArrayMinSize(1)
  @ValidateNested({ each: true }) @Type(() => DurationOptionInputDto)
  options!: DurationOptionInputDto[];
}
