import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token received via email' })
  @IsString()
  token!: string;

  @ApiPropertyOptional({ description: 'Password for new user account (required if user does not exist)' })
  @IsOptional()
  @IsString()
  password?: string;
}