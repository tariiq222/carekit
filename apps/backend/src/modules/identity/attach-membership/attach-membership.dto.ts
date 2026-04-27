import { IsString, MinLength, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AttachMembershipDto {
  @ApiProperty({ description: 'Phone number or email address of the existing user', example: '+966501234567' })
  @IsString()
  @MinLength(3)
  identifier!: string;

  @ApiProperty({ description: 'MembershipRole to assign', example: 'EMPLOYEE' })
  @IsString()
  role!: string;

  @ApiPropertyOptional({ description: 'Branch UUID for the membership', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional()
  @IsString()
  branchId?: string;
}