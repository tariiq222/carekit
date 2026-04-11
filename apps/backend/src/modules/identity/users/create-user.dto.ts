import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { UserRole, UserGender } from '@prisma/client';

export class CreateUserDto {
  @IsString() tenantId!: string;
  @IsEmail() email!: string;
  @IsString() @MinLength(6) password!: string;
  @IsString() name!: string;
  @IsEnum(UserRole) role!: UserRole;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(UserGender) gender?: UserGender;
  @IsOptional() @IsString() customRoleId?: string;
}
