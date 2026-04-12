import { IsInt, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateServiceDto {
  @IsString() @MaxLength(200) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @IsOptional() @IsString() descriptionAr?: string;
  @IsOptional() @IsString() descriptionEn?: string;
  @IsInt() @Min(1) durationMins!: number;
  @IsNumber() @Min(0) price!: number;
  @IsOptional() @IsString() @MaxLength(8) currency?: string;
  @IsOptional() @IsString() imageUrl?: string;
}
