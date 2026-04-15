import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateEmployeeDto {
  @IsOptional() @IsString() @MaxLength(100) title?: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(200) specialty?: string;
  @IsOptional() @IsString() @MaxLength(200) specialtyAr?: string;
  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() bioAr?: string;
  @IsOptional() @IsInt() @Min(0) experience?: number;
  @IsOptional() @IsString() education?: string;
  @IsOptional() @IsString() educationAr?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() avatarUrl?: string | null;
}
