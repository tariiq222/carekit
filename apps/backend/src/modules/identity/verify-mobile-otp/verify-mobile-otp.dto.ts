import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsString, Length, MinLength } from 'class-validator';

export enum MobileOtpPurposeDto {
  REGISTER = 'register',
  LOGIN = 'login',
}

export class VerifyMobileOtpDto {
  @ApiProperty({ description: 'Phone or email used to request the OTP' })
  @IsString()
  @MinLength(3)
  identifier!: string;

  @ApiProperty({ description: '4-digit OTP code', example: '1234' })
  @IsString()
  @Length(4, 4)
  code!: string;

  @ApiProperty({ enum: MobileOtpPurposeDto, description: 'Whether this verifies a registration or a login OTP' })
  @IsEnum(MobileOtpPurposeDto)
  purpose!: MobileOtpPurposeDto;
}
