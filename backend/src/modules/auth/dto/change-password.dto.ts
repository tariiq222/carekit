import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ description: 'Current account password', maxLength: 128 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  currentPassword!: string;

  @ApiProperty({
    description:
      'New password — min 8 chars, must include uppercase, lowercase, and digit',
    minLength: 8,
    maxLength: 128,
    example: 'NewPass123',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(128)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/, {
    message:
      'newPassword must contain at least one uppercase letter, one lowercase letter, one digit, and be 8-128 characters',
  })
  newPassword!: string;
}
