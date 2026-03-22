import { IsEnum, IsNotEmpty, IsString } from 'class-validator';

export class RegisterFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;

  @IsEnum(['ios', 'android'])
  @IsNotEmpty()
  platform!: 'ios' | 'android';
}
