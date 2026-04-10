import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SendOtpDto {
  @ApiProperty({ description: 'User email address', example: 'user@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;
}

export class VerifyOtpDto {
  @ApiProperty({ description: 'User email address', example: 'user@clinic.com' })
  @IsEmail()
  @IsNotEmpty()
  @Transform(({ value }: { value: string }) => value?.trim().toLowerCase())
  email!: string;

  @ApiProperty({ description: 'OTP code sent to email', example: '123456', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  code!: string;
}
