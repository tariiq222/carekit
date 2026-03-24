import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RefreshTokenDto {
  @IsString()
  @IsOptional()
  @MaxLength(500)
  refreshToken?: string;
}
