import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWhitelabelDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) systemName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) systemNameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) logoUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) faviconUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(7) primaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(7) secondaryColor?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) fontFamily?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) domain?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() clinicCanEdit?: boolean;
}
