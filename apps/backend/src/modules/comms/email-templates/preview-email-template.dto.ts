import { IsIn, IsObject, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PreviewEmailTemplateDto {
  @ApiProperty({ description: 'Language to render the template in', example: 'ar', enum: ['ar', 'en'], enumName: 'PreviewLang' })
  @IsIn(['ar', 'en'])
  lang!: 'ar' | 'en';

  @ApiPropertyOptional({
    description: 'Template variable values for the preview render',
    example: { name: 'Fatima', date: '2026-04-17' },
  })
  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;
}
