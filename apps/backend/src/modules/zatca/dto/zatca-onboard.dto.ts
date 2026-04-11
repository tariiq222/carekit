import { IsString, IsNotEmpty, Length } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ZatcaOnboardDto {
  @ApiProperty({
    description: 'OTP received from ZATCA Fatoora portal for device onboarding',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  @Length(4, 10)
  otp!: string;
}

export interface OnboardingResult {
  success: boolean;
  message: string;
  phase?: string;
}

export interface OnboardingStatus {
  phase: 'phase1' | 'phase2';
  hasCredentials: boolean;
  csidConfigured: boolean;
  privateKeyStored: boolean;
}
