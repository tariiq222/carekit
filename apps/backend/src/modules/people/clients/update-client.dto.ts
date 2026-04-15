import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { ClientAccountType, ClientBloodType, ClientGender, ClientSource } from '@prisma/client';

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

// Saudi phone only: +966 then 5 then 8 digits (local number 5XXXXXXXX)
const PHONE_REGEX = /^\+9665\d{8}$/;

export class UpdateClientDto {
  @IsOptional() @IsString() @MaxLength(255) firstName?: string;
  @IsOptional() @IsString() @MaxLength(255) middleName?: string | null;
  @IsOptional() @IsString() @MaxLength(255) lastName?: string;

  @IsOptional() @IsString() @Matches(PHONE_REGEX, { message: 'phone must be a Saudi number +9665XXXXXXXX' }) phone?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @Transform(toUpper) @IsEnum(ClientGender) gender?: ClientGender | null;
  @IsOptional() @IsDateString() dateOfBirth?: string | null;

  @IsOptional() @IsString() @MaxLength(100) nationality?: string | null;
  @IsOptional() @IsString() @MaxLength(20) nationalId?: string | null;

  @IsOptional() @IsString() @MaxLength(255) emergencyName?: string | null;
  @IsOptional() @IsString() @Matches(PHONE_REGEX, { message: 'emergencyPhone must be a Saudi number +9665XXXXXXXX' }) emergencyPhone?: string | null;

  @IsOptional() @Transform(toUpper) @IsEnum(ClientBloodType) bloodType?: ClientBloodType | null;
  @IsOptional() @IsString() @MaxLength(1000) allergies?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) chronicConditions?: string | null;

  @IsOptional() @IsString() avatarUrl?: string | null;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string | null;
  @IsOptional() @Transform(toUpper) @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @Transform(toUpper) @IsEnum(ClientAccountType) accountType?: ClientAccountType;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
