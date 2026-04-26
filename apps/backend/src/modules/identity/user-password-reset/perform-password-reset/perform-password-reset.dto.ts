import { IsNotEmpty, IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PerformPasswordResetDto {
  @ApiProperty({ description: 'Reset token from the email link' })
  @IsString()
  @IsNotEmpty()
  token!: string;

  @ApiProperty({ description: 'New password (≥8 chars)', example: 'newSecure123' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
