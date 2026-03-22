import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { UserGender } from '@prisma/client';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim().replace(/<[^>]*>/g, ''))
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim().replace(/<[^>]*>/g, ''))
  lastName!: string;

  @IsOptional()
  @IsString()
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be a valid international phone number' })
  phone?: string;

  @IsOptional()
  @IsEnum(UserGender, { message: 'gender must be either male or female' })
  gender?: UserGender;
}
