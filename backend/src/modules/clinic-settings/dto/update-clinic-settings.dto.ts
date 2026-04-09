import {
  IsBoolean, IsInt, IsObject, IsOptional,
  IsString, Max, MaxLength, Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateClinicSettingsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) companyNameAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) companyNameEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(50) businessRegistration?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(15) vatRegistrationNumber?: string;
  @ApiPropertyOptional() @IsOptional() vatRate?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) sellerAddress?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) clinicCity?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10) postalCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) contactPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255) contactEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsObject() socialMedia?: Record<string, string>;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) aboutAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) aboutEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) privacyPolicyAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) privacyPolicyEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) termsAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(10000) termsEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) cancellationPolicyAr?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(5000) cancellationPolicyEn?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() defaultLanguage?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timezone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() weekStartDay?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() dateFormat?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() timeFormat?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailHeaderShowLogo?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() emailHeaderShowName?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) emailFooterPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) emailFooterWebsite?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) emailFooterInstagram?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) emailFooterTwitter?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) emailFooterSnapchat?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) emailFooterTiktok?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) emailFooterLinkedin?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) emailFooterYoutube?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(5) @Max(480) sessionDuration?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) @Max(1440) reminderBeforeMinutes?: number;
}
