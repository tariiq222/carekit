import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OtpChannel, OtpPurpose } from '@prisma/client';

export class RequestOtpDto {
  @ApiProperty({ enum: OtpChannel, description: 'OTP delivery channel', example: 'EMAIL' })
  @IsEnum(OtpChannel)
  channel!: OtpChannel;

  @ApiProperty({ description: 'Email address or phone number (E.164 format)', example: 'user@example.com' })
  @IsNotEmpty()
  @IsString()
  identifier!: string;

  @ApiProperty({ enum: OtpPurpose, description: 'Purpose of the OTP', example: 'GUEST_BOOKING' })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;

  @ApiProperty({ description: 'hCaptcha token', example: '10000000-aaaa-bbbb-cccc-000000000001' })
  @IsString()
  @IsNotEmpty()
  hCaptchaToken!: string;
}
