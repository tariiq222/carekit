import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LogoutDto {
  @ApiProperty({ description: 'Refresh token to revoke', example: 'a1b2c3d4-...' })
  @IsString()
  refreshToken!: string;
}