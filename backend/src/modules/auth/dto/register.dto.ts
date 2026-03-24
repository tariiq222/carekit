import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
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
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/, {
    message: 'password must contain at least one uppercase letter, one lowercase letter, one digit, and be 8-128 characters',
  })
  password!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim().replace(/<[^>]*>/g, ''))
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim().replace(/<[^>]*>/g, ''))
  lastName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^\+[1-9]\d{6,14}$/, { message: 'phone must be a valid international phone number' })
  phone?: string;

  @IsOptional()
  @IsEnum(UserGender, { message: 'gender must be either male or female' })
  gender?: UserGender;
}
