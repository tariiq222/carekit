import { IsBoolean, IsOptional, IsString, MaxLength, IsHexColor } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWhitelabelDto {
  // Identity
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  systemName?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  systemNameAr?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  productTagline?: string;

  // Assets
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  logoUrl?: string | null;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  faviconUrl?: string | null;

  // Colors
  @ApiPropertyOptional({ example: '#354FD8' }) @IsOptional() @IsHexColor()
  colorPrimary?: string;

  @ApiPropertyOptional({ example: '#5B72E8' }) @IsOptional() @IsHexColor()
  colorPrimaryLight?: string;

  @ApiPropertyOptional({ example: '#2438B0' }) @IsOptional() @IsHexColor()
  colorPrimaryDark?: string;

  @ApiPropertyOptional({ example: '#82CC17' }) @IsOptional() @IsHexColor()
  colorAccent?: string;

  @ApiPropertyOptional({ example: '#5A9010' }) @IsOptional() @IsHexColor()
  colorAccentDark?: string;

  @ApiPropertyOptional({ example: '#EEF1F8' }) @IsOptional() @IsHexColor()
  colorBackground?: string;

  // Typography
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100)
  fontFamily?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000)
  fontUrl?: string | null;

  // SaaS-level
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  domain?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  clinicCanEdit?: boolean;
}
