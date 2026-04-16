import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';
import { ClientAccountType, ClientBloodType, ClientGender, ClientSource } from '@prisma/client';

const toUpper = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toUpperCase() : value;

// Saudi phone only: +966 then 5 then 8 digits (local number 5XXXXXXXX)
const PHONE_REGEX = /^\+9665\d{8}$/;

export class CreateClientDto {
  @IsString() @IsNotEmpty() @MaxLength(255) firstName!: string;
  @IsOptional() @IsString() @MaxLength(255) middleName?: string;
  @IsString() @IsNotEmpty() @MaxLength(255) lastName!: string;

  @IsString() @Matches(PHONE_REGEX, { message: 'phone must be a Saudi number +9665XXXXXXXX' }) phone!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @Transform(toUpper) @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsDateString() dateOfBirth?: string;

  @IsOptional() @IsString() @MaxLength(100) nationality?: string;
  @IsOptional() @IsString() @MaxLength(20) nationalId?: string;

  @IsOptional() @IsString() @MaxLength(255) emergencyName?: string;
  @IsOptional() @IsString() @Matches(PHONE_REGEX, { message: 'emergencyPhone must be a Saudi number +9665XXXXXXXX' }) emergencyPhone?: string;

  @IsOptional() @Transform(toUpper) @IsEnum(ClientBloodType) bloodType?: ClientBloodType;
  @IsOptional() @IsString() @MaxLength(1000) allergies?: string;
  @IsOptional() @IsString() @MaxLength(1000) chronicConditions?: string;

  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
  @IsOptional() @Transform(toUpper) @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @Transform(toUpper) @IsEnum(ClientAccountType) accountType?: ClientAccountType;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsUUID() userId?: string;
}
