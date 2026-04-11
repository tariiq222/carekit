import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateLicenseDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasCoupons?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasIntakeForms?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasChatbot?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasRatings?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasMultiBranch?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasReports?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasRecurring?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasWalkIn?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasWaitlist?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasZoom?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasZatca?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasDepartments?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasGroups?: boolean;
}
