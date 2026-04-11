import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RegisterFcmTokenDto {
  @ApiProperty({ description: 'FCM device token', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;

  @ApiProperty({ enum: ['ios', 'android'], description: 'Device platform' })
  @IsEnum(['ios', 'android'])
  @IsNotEmpty()
  platform!: 'ios' | 'android';
}
