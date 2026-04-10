import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreatePractitionerDto {
  @ApiProperty({
    description: 'User ID to link as practitioner',
    format: 'uuid',
  })
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @ApiPropertyOptional({
    description:
      'Specialty ID (UUID) — populates specialty/specialtyAr from the Specialty record',
    format: 'uuid',
  })
  @IsOptional()
  @IsUUID()
  specialtyId?: string;

  @ApiPropertyOptional({
    description:
      'Specialty name in English (ignored when specialtyId is provided)',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialty?: string;

  @ApiPropertyOptional({
    description: 'Specialty name in Arabic',
    maxLength: 200,
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialtyAr?: string;

  @ApiPropertyOptional({
    description: 'Practitioner bio in English',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @ApiPropertyOptional({
    description: 'Practitioner bio in Arabic',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bioAr?: string;

  @ApiPropertyOptional({ description: 'Years of experience', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  @ApiPropertyOptional({ description: 'Education in English', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  education?: string;

  @ApiPropertyOptional({ description: 'Education in Arabic', maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  educationAr?: string;
}
