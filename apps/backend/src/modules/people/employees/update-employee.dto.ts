import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateEmployeeDto {
  @ApiPropertyOptional({ description: 'Professional title (e.g. Dr.)', example: 'Dr.' })
  @IsOptional() @IsString() @MaxLength(100) title?: string;

  @ApiPropertyOptional({ description: 'Full name in English', example: 'Khalid Al-Otaibi' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;

  @ApiPropertyOptional({ description: 'Full name in Arabic', example: 'خالد العتيبي' })
  @IsOptional() @IsString() @MaxLength(200) nameAr?: string;

  @ApiPropertyOptional({ description: 'Specialty label in English', example: 'Physiotherapy' })
  @IsOptional() @IsString() @MaxLength(200) specialty?: string;

  @ApiPropertyOptional({ description: 'Specialty label in Arabic', example: 'العلاج الطبيعي' })
  @IsOptional() @IsString() @MaxLength(200) specialtyAr?: string;

  @ApiPropertyOptional({ description: 'Short biography in English', example: 'Specialist with 10 years of experience.' })
  @IsOptional() @IsString() bio?: string;

  @ApiPropertyOptional({ description: 'Short biography in Arabic', example: 'متخصص بخبرة 10 سنوات.' })
  @IsOptional() @IsString() bioAr?: string;

  @ApiPropertyOptional({ description: 'Years of experience', example: 10 })
  @IsOptional() @IsInt() @Min(0) experience?: number;

  @ApiPropertyOptional({ description: 'Education details in English', example: 'King Saud University — BSc Physical Therapy' })
  @IsOptional() @IsString() education?: string;

  @ApiPropertyOptional({ description: 'Education details in Arabic', example: 'جامعة الملك سعود — بكالوريوس علاج طبيعي' })
  @IsOptional() @IsString() educationAr?: string;

  @ApiPropertyOptional({ description: 'Whether the employee is active', example: true })
  @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ description: 'Avatar image URL', example: 'https://cdn.example.com/avatars/khalid.jpg', nullable: true })
  @IsOptional() @IsString() avatarUrl?: string | null;
}
