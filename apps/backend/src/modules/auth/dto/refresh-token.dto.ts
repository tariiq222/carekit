import { IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class RefreshTokenDto {
  @ApiPropertyOptional({
    description: 'Refresh token (omit to use the httpOnly cookie)',
    maxLength: 500,
  })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  refreshToken?: string;
}
