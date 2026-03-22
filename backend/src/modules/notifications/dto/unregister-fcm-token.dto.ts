import { IsNotEmpty, IsString } from 'class-validator';

export class UnregisterFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  token!: string;
}
