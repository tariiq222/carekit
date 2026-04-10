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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ description: 'User email address', example: 'user@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @ApiProperty({
    description: 'Password — min 8 chars, must include uppercase, lowercase, and digit',
    minLength: 8,
    maxLength: 128,
    example: 'SecurePass1',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/, {
    message:
      'password must contain at least one uppercase letter, one lowercase letter, one digit, and be 8-128 characters',
  })
  password!: string;

  @ApiProperty({ description: 'First name', maxLength: 255, example: 'Ahmad' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) =>
    value?.trim().replace(/<[^>]*>/g, ''),
  )
  firstName!: string;

  @ApiProperty({ description: 'Last name', maxLength: 255, example: 'Al-Rashidi' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) =>
    value?.trim().replace(/<[^>]*>/g, ''),
  )
  lastName!: string;

  @ApiPropertyOptional({
    description: 'International phone number',
    example: '+966501234567',
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  @Matches(/^\+[1-9]\d{6,14}$/, {
    message: 'phone must be a valid international phone number',
  })
  phone?: string;

  @ApiPropertyOptional({ enum: UserGender, description: 'User gender' })
  @IsOptional()
  @IsEnum(UserGender, { message: 'gender must be either male or female' })
  gender?: UserGender;
}
