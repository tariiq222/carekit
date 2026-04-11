import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePractitionerDto {
  @ApiPropertyOptional({
    description: 'Title/prefix (e.g. Dr.)',
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({
    description: 'Practitioner name in Arabic',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  nameAr?: string;

  @ApiPropertyOptional({ description: 'Specialty in English', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialty?: string;

  @ApiPropertyOptional({ description: 'Specialty in Arabic', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialtyAr?: string;

  @ApiPropertyOptional({ description: 'Bio in English', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({ description: 'Bio in Arabic', maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bioAr?: string;

  @ApiPropertyOptional({ description: 'Years of experience', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  @ApiPropertyOptional({
    description: 'Education details in English',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  education?: string;

  @ApiPropertyOptional({
    description: 'Education details in Arabic',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  educationAr?: string;

  @ApiPropertyOptional({ description: 'Whether the practitioner is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the practitioner is accepting new bookings',
  })
  @IsOptional()
  @IsBoolean()
  isAcceptingBookings?: boolean;
}
