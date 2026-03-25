import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { BloodType, UserGender } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

const sanitize = ({ value }: { value: string }) =>
  value?.trim().replace(/<[^>]*>/g, '');

export class UpdatePatientDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) @Transform(sanitize)
  firstName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) @Transform(sanitize)
  middleName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) @Transform(sanitize)
  lastName?: string;

  @ApiPropertyOptional({ enum: UserGender }) @IsOptional() @IsEnum(UserGender)
  gender?: UserGender;

  @ApiPropertyOptional() @IsOptional() @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) @Transform(sanitize)
  nationality?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) @Transform(sanitize)
  nationalId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\+[1-9]\d{6,14}$/)
  phone?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) @Transform(sanitize)
  emergencyName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^\+[1-9]\d{6,14}$/)
  emergencyPhone?: string;

  @ApiPropertyOptional({ enum: BloodType }) @IsOptional() @IsEnum(BloodType)
  bloodType?: BloodType;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) @Transform(sanitize)
  allergies?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) @Transform(sanitize)
  chronicConditions?: string;
}
