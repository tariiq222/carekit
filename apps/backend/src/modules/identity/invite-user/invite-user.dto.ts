import { IsEmail, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MembershipRole } from '@prisma/client';

export class InviteUserDto {
  @ApiProperty({ description: 'Email address of the invitee.', example: 'ahmad@clinic.sa' })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({ description: 'Role within the inviting organization.', enum: MembershipRole })
  @IsEnum(MembershipRole)
  role!: MembershipRole;

  @ApiPropertyOptional({ description: 'Per-org display name carried into the new Membership.', example: 'د. أحمد المطيري' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Per-org job title carried into the new Membership.', example: 'استشاري نفسي' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  jobTitle?: string;
}
