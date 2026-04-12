import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class AddHolidayDto {
  @IsUUID() branchId!: string;
  @IsDateString() date!: string;
  @IsString() @MaxLength(200) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
}
