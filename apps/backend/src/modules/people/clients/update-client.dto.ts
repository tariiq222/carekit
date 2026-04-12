import { IsBoolean, IsDateString, IsEmail, IsEnum, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ClientGender, ClientSource } from '@prisma/client';

export class UpdateClientDto {
  @IsOptional() @IsString() @MaxLength(200) name?: string;
  @IsOptional() @IsString() @Matches(/^\+?[0-9]{9,15}$/) phone?: string | null;
  @IsOptional() @IsEmail() email?: string | null;
  @IsOptional() @IsEnum(ClientGender) gender?: ClientGender;
  @IsOptional() @IsDateString() dateOfBirth?: string | null;
  @IsOptional() @IsString() avatarUrl?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  @IsOptional() @IsEnum(ClientSource) source?: ClientSource;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
