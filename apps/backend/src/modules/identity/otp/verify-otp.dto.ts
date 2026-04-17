import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { OtpChannel, OtpPurpose } from '@prisma/client';

export class VerifyOtpDto {
  @ApiProperty({ enum: OtpChannel, description: 'OTP delivery channel', example: 'EMAIL' })
  @IsEnum(OtpChannel)
  channel!: OtpChannel;

  @ApiProperty({ description: 'Email address or phone number', example: 'user@example.com' })
  @IsString()
  @IsNotEmpty()
  identifier!: string;

  @ApiProperty({ description: '6-digit OTP code', example: '123456' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ enum: OtpPurpose, description: 'Purpose of the OTP', example: 'GUEST_BOOKING' })
  @IsEnum(OtpPurpose)
  purpose!: OtpPurpose;
}
