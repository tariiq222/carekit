import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export class UpsertBrandingDto {
  @ApiProperty({ description: 'Clinic name in Arabic', example: 'عيادة الرعاية' })
  @IsString() @MaxLength(200) clinicNameAr!: string;

  @ApiPropertyOptional({ description: 'Clinic name in English', example: 'CareKit Clinic' })
  @IsOptional() @IsString() @MaxLength(200) clinicNameEn?: string;

  @ApiPropertyOptional({ description: 'Logo image URL', example: 'https://example.com/logo.png' })
  @IsOptional() @IsString() logoUrl?: string;

  @ApiPropertyOptional({ description: 'Favicon image URL', example: 'https://example.com/favicon.ico' })
  @IsOptional() @IsString() faviconUrl?: string;

  @ApiPropertyOptional({ description: 'Primary brand color (hex)', example: '#354FD8' })
  @IsOptional() @IsString() @Matches(HEX_COLOR_REGEX, { message: 'primaryColor must be a hex color' }) primaryColor?: string;

  @ApiPropertyOptional({ description: 'Accent brand color (hex)', example: '#82CC17' })
  @IsOptional() @IsString() @Matches(HEX_COLOR_REGEX, { message: 'accentColor must be a hex color' }) accentColor?: string;

  @ApiPropertyOptional({ description: 'Font family name', example: 'IBM Plex Sans Arabic' })
  @IsOptional() @IsString() @MaxLength(200) fontFamily?: string;

  @ApiPropertyOptional({ description: 'Custom CSS injected into the clinic app', example: ':root { --radius: 8px; }' })
  @IsOptional() @IsString() customCss?: string;
}
