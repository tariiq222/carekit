import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class UpdateServiceDto {
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsOptional() @IsInt() @Min(1) durationMins?: number;
  @IsOptional() @IsNumber() @Min(0) price?: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() imageUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
