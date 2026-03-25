import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BloodType, UserGender } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const sanitize = ({ value }: { value: string }) =>
  value?.trim().replace(/<[^>]*>/g, '');

export class CreateWalkInPatientDto {
  // ── Personal ──
  @ApiProperty({ example: 'أحمد' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(sanitize)
  firstName!: string;

  @ApiPropertyOptional({ example: 'محمد' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(sanitize)
  middleName?: string;

  @ApiProperty({ example: 'العمري' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(sanitize)
  lastName!: string;

  @ApiPropertyOptional({ enum: UserGender })
  @IsOptional()
  @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional({ example: '1990-05-15' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'سعودي' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Transform(sanitize)
  nationality?: string;

  @ApiPropertyOptional({ example: '1XXXXXXXXX' })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  @Transform(sanitize)
  nationalId?: string;

  // ── Contact ──
  @ApiProperty({ example: '+966501234567' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be a valid international phone number' })
  phone!: string;

  // ── Emergency ──
  @ApiPropertyOptional({ example: 'محمد العمري' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Transform(sanitize)
  emergencyName?: string;

  @ApiPropertyOptional({ example: '+966501234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'emergencyPhone must be a valid international phone number' })
  emergencyPhone?: string;

  // ── Medical ──
  @ApiPropertyOptional({ enum: BloodType })
  @IsOptional()
  @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional({ example: 'البنسلين، الفول السوداني' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(sanitize)
  allergies?: string;

  @ApiPropertyOptional({ example: 'السكري، ضغط الدم' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @Transform(sanitize)
  chronicConditions?: string;
}
