import {
  IsOptional, IsString, IsBoolean, IsNumber, IsInt,
  Min, Max, IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpsertOrgSettingsDto {
  @IsOptional() @IsString() companyNameAr?: string;
  @IsOptional() @IsString() companyNameEn?: string;
  @IsOptional() @IsString() businessRegistration?: string;
  @IsOptional() @IsString() vatRegistrationNumber?: string;
  @IsOptional() @Type(() => Number) @IsNumber() vatRate?: number;
  @IsOptional() @IsString() sellerAddress?: string;
  @IsOptional() @IsString() organizationCity?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() socialMedia?: Record<string, string>;
  @IsOptional() @IsString() aboutAr?: string;
  @IsOptional() @IsString() aboutEn?: string;
  @IsOptional() @IsString() privacyPolicyAr?: string;
  @IsOptional() @IsString() privacyPolicyEn?: string;
  @IsOptional() @IsString() termsAr?: string;
  @IsOptional() @IsString() termsEn?: string;
  @IsOptional() @IsString() cancellationPolicyAr?: string;
  @IsOptional() @IsString() cancellationPolicyEn?: string;
  @IsOptional() @IsString() defaultLanguage?: string;
  @IsOptional() @IsString() timezone?: string;
  @IsOptional() @IsString() weekStartDay?: string;
  @IsOptional() @IsString() dateFormat?: string;
  @IsOptional() @IsString() timeFormat?: string;
  @IsOptional() @IsBoolean() emailHeaderShowLogo?: boolean;
  @IsOptional() @IsBoolean() emailHeaderShowName?: boolean;
  @IsOptional() @IsString() emailFooterPhone?: string;
  @IsOptional() @IsString() emailFooterWebsite?: string;
  @IsOptional() @IsString() emailFooterInstagram?: string;
  @IsOptional() @IsString() emailFooterTwitter?: string;
  @IsOptional() @IsString() emailFooterSnapchat?: string;
  @IsOptional() @IsString() emailFooterTiktok?: string;
  @IsOptional() @IsString() emailFooterLinkedin?: string;
  @IsOptional() @IsString() emailFooterYoutube?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(15) @Max(480) sessionDuration?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) reminderBeforeMinutes?: number;
  @IsOptional() @IsIn(['service_first', 'employee_first', 'both']) bookingFlowOrder?: string;
  @IsOptional() @IsBoolean() paymentMoyasarEnabled?: boolean;
  @IsOptional() @IsBoolean() paymentAtClinicEnabled?: boolean;
}
