import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiProperty({ description: 'Refresh token issued at login', example: 'a1b2c3d4-...' })
  @IsString()
  refreshToken!: string;
}