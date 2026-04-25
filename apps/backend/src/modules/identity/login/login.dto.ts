import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ description: 'User email address', example: 'user@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: 'Account password (min 8 characters)', example: 'P@ssw0rd123', format: 'password' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ description: 'hCaptcha verification token' })
  @IsString()
  @IsNotEmpty()
  hCaptchaToken!: string;
}
