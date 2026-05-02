import { IsOptional, IsString, MinLength, MaxLength, Matches } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AcceptInvitationDto {
  @ApiProperty({ description: 'Invitation token sent by email.' })
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  token!: string;

  /**
   * Required only when the invited email has no existing User account. If the
   * recipient already has an account, password is ignored. The handler does
   * NOT signal which branch was taken — caller passes the password
   * unconditionally; if unused it is silently dropped.
   */
  @ApiPropertyOptional({
    description: 'Password for new account creation (min 8 chars, must contain uppercase + digit). Ignored if the email already has an account.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  @Matches(/[A-Z]/, { message: 'password must contain at least one uppercase letter' })
  @Matches(/[0-9]/, { message: 'password must contain at least one digit' })
  password?: string;

  @ApiPropertyOptional({ description: 'Name for new account creation (ignored if account exists).' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;
}
