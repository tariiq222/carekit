import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class RegisterFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;

  @IsEnum(['ios', 'android'])
  @IsNotEmpty()
  platform!: 'ios' | 'android';
}
