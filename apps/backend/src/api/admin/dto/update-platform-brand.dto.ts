import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdatePlatformLocaleDto {
  @ApiPropertyOptional({ description: 'Default platform locale', example: 'ar' })
  @IsOptional() @IsString() default?: string;

  @ApiPropertyOptional({ description: 'Whether RTL is the default direction', example: true })
  @IsOptional() @IsBoolean() rtlDefault?: boolean;

  @ApiPropertyOptional({ description: 'Date format string', example: 'dd/MM/yyyy' })
  @IsOptional() @IsString() dateFormat?: string;

  @ApiPropertyOptional({ description: 'Currency format', example: 'SAR' })
  @IsOptional() @IsString() currencyFormat?: string;
}

export class UpdatePlatformBrandDto {
  @ApiPropertyOptional({ description: 'Logo URL', example: 'https://cdn.deqah.app/logo.png' })
  @IsOptional() @IsString() logoUrl?: string;

  @ApiPropertyOptional({ description: 'Primary brand color (hex)', example: '#354FD8' })
  @IsOptional() @IsString() primaryColor?: string;

  @ApiPropertyOptional({ description: 'Accent brand color (hex)', example: '#82CC17' })
  @IsOptional() @IsString() accentColor?: string;

  @ApiPropertyOptional({ description: 'Locale settings', type: () => UpdatePlatformLocaleDto })
  @IsOptional() @ValidateNested() @Type(() => UpdatePlatformLocaleDto) locale?: UpdatePlatformLocaleDto;
}
