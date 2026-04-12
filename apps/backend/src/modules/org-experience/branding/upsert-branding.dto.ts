import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

export class UpsertBrandingDto {
  @IsString() @MaxLength(200) clinicNameAr!: string;
  @IsOptional() @IsString() @MaxLength(200) clinicNameEn?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() faviconUrl?: string;
  @IsOptional() @IsString() @Matches(HEX_COLOR_REGEX, { message: 'primaryColor must be a hex color' }) primaryColor?: string;
  @IsOptional() @IsString() @Matches(HEX_COLOR_REGEX, { message: 'accentColor must be a hex color' }) accentColor?: string;
  @IsOptional() @IsString() @MaxLength(200) fontFamily?: string;
  @IsOptional() @IsString() customCss?: string;
}
