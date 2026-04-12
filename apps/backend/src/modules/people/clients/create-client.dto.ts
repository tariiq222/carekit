import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';
import { ClientGender, ClientSource } from '@prisma/client';

export class CreateClientDto {
  @IsString() @MaxLength(200) name!: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9]{9,15}$/) phone?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @IsUUID() userId?: string;
}
