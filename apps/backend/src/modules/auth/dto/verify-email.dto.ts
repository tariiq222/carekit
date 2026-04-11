import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification token', maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  code!: string;
}
