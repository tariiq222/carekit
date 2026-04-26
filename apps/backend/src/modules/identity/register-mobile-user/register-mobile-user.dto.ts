import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterMobileUserDto {
  @ApiProperty({ description: 'First name', example: 'سارة' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ description: 'Last name', example: 'الأحمد' })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @ApiProperty({ description: 'E.164 phone', example: '+966501234567' })
  @Matches(/^\+\d{8,15}$/, { message: 'Phone must be E.164 (+966...)' })
  phone!: string;

  @ApiProperty({ description: 'Email', example: 'sara@example.com' })
  @IsEmail()
  email!: string;
}
