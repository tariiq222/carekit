import { IsEmail, IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { UserRole, UserGender } from '@prisma/client';

export class CreateUserDto {
  @IsEmail() email!: string;
  @IsString() @MinLength(8) password!: string;
  @IsString() name!: string;
  @IsEnum(UserRole) role!: UserRole;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(UserGender) gender?: UserGender;
  @IsOptional() @IsUUID() customRoleId?: string;
}
