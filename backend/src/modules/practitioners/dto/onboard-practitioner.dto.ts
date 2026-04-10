import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OnboardPractitionerDto {
  @ApiPropertyOptional({ description: 'Title/prefix e.g. Dr.', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @ApiProperty({ description: 'Practitioner name in English', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameEn!: string;

  @ApiProperty({ description: 'Practitioner name in Arabic', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameAr!: string;

  @ApiProperty({ description: 'Practitioner email address', example: 'dr.ahmed@clinic.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Specialty in English' })
  @IsString()
  @IsNotEmpty()
  specialty!: string;

  @ApiPropertyOptional({ description: 'Specialty in Arabic' })
  @IsOptional()
  @IsString()
  specialtyAr?: string;

  @ApiPropertyOptional({ description: 'Bio in English' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiPropertyOptional({ description: 'Bio in Arabic' })
  @IsOptional()
  @IsString()
  bioAr?: string;

  @ApiPropertyOptional({ description: 'Years of experience', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  @ApiPropertyOptional({ description: 'Education details in English' })
  @IsOptional()
  @IsString()
  education?: string;

  @ApiPropertyOptional({ description: 'Education details in Arabic' })
  @IsOptional()
  @IsString()
  educationAr?: string;

  @ApiPropertyOptional({ description: 'Avatar image URL' })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Whether the practitioner is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
