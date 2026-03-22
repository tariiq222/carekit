import { ArrayNotEmpty, IsArray, IsBoolean, IsEnum, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';

export class AssignPractitionerServiceDto {
  @IsUUID()
  @IsNotEmpty()
  serviceId!: string;

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
  customDuration?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferBefore?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  bufferAfter?: number;

  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(['clinic_visit', 'phone_consultation', 'video_consultation'], { each: true })
  availableTypes!: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
