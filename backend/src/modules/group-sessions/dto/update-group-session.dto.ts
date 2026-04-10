import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class UpdateGroupSessionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameEn?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionEn?: string;

  @IsOptional()
  @IsUUID()
  practitionerId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  minParticipants?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxParticipants?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePerPersonHalalat?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  durationMinutes?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  paymentDeadlineHours?: number;

  @IsOptional()
  @IsDateString()
  startTime?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
