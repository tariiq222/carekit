import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AttachMembershipDto {
  @ApiProperty({ description: 'Phone number or email address of the existing user', example: '+966501234567' })
  @IsString()
  @MinLength(3)
  identifier!: string;

  @ApiProperty({ description: 'MembershipRole to assign', example: 'RECEPTIONIST' })
  @IsString()
  role!: string;
}