import {
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'User email address', example: 'user@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;
}

export class ResetPasswordDto {
  @ApiProperty({ description: 'User email address', example: 'user@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @ApiProperty({ description: 'Reset code sent to email', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  code!: string;

  @ApiProperty({
    description: 'New password — min 8 chars',
    minLength: 8,
    maxLength: 128,
    example: 'NewSecure1',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
