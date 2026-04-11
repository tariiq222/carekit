import { IsDateString, IsEmail, IsEnum, IsOptional, IsString } from 'class-validator';
import { ClientGender, ClientSource } from '@prisma/client';

export class CreateClientDto {
  @IsString() tenantId!: string;
  @IsString() name!: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @IsString() userId?: string;
}
