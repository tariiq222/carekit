import { IsArray, IsBoolean, IsEnum, IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePractitionerServiceDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  priceClinic?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePhone?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceVideo?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  customDuration?: number | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferBefore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferAfter?: number;

  @IsOptional()
  @IsArray()
  @IsEnum(['clinic_visit', 'phone_consultation', 'video_consultation'], { each: true })
  availableTypes?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
