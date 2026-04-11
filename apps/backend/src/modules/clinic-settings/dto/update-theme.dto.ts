import { IsString, IsUrl, IsOptional, IsHexColor } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'
import type { ClinicTheme } from '@carekit/shared/types'

export class UpdateThemeDto implements Partial<ClinicTheme> {
  @ApiPropertyOptional({ example: '#354FD8' })
  @IsOptional()
  @IsHexColor()
  colorPrimary?: string

  @ApiPropertyOptional({ example: '#5B72E8' })
  @IsOptional()
  @IsHexColor()
  colorPrimaryLight?: string

  @ApiPropertyOptional({ example: '#2438B0' })
  @IsOptional()
  @IsHexColor()
  colorPrimaryDark?: string

  @ApiPropertyOptional({ example: '#82CC17' })
  @IsOptional()
  @IsHexColor()
  colorAccent?: string

  @ApiPropertyOptional({ example: '#5A9010' })
  @IsOptional()
  @IsHexColor()
  colorAccentDark?: string

  @ApiPropertyOptional({ example: '#EEF1F8' })
  @IsOptional()
  @IsHexColor()
  colorBackground?: string

  @ApiPropertyOptional({ example: 'IBM Plex Sans Arabic' })
  @IsOptional()
  @IsString()
  fontFamily?: string

  @ApiPropertyOptional({ example: 'https://fonts.googleapis.com/css2?...' })
  @IsOptional()
  @IsUrl()
  fontUrl?: string | null

  @ApiPropertyOptional({ example: 'https://cdn.example.com/logo.png' })
  @IsOptional()
  @IsUrl()
  logoUrl?: string | null

  @ApiPropertyOptional({ example: 'عيادة الرحمة' })
  @IsOptional()
  @IsString()
  productName?: string

  @ApiPropertyOptional({ example: 'إدارة متكاملة' })
  @IsOptional()
  @IsString()
  productTagline?: string
}
