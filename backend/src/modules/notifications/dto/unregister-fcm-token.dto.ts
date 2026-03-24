import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UnregisterFcmTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  token!: string;
}
