import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RegisterTenantDto {
  @ApiProperty({ description: 'Full name of the owner', example: 'علي محمد' })
  @IsString() @IsNotEmpty() name!: string;

  @ApiProperty({ description: 'Email address (used as login)', example: 'ali@clinic.com' })
  @IsEmail() email!: string;

  @ApiProperty({ description: 'Mobile phone number', example: '0501234567' })
  @IsString() @IsNotEmpty() phone!: string;

  @ApiProperty({ description: 'Password — min 8 chars, ≥1 uppercase, ≥1 digit', example: 'Pass@1234' })
  @IsString()
  @MinLength(8)
  @Matches(/(?=.*[A-Z])(?=.*\d)/, { message: 'password must have at least one uppercase letter and one digit' })
  password!: string;

  @ApiProperty({ description: 'Business name in Arabic', example: 'عيادة الرعاية' })
  @IsString() @IsNotEmpty() businessNameAr!: string;

  @ApiPropertyOptional({ description: 'Business name in English', example: 'Deqah Clinic' })
  @IsOptional() @IsString() businessNameEn?: string;
}
