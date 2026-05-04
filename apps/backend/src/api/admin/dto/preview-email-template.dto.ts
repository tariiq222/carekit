import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional } from 'class-validator';

export class PreviewEmailTemplateDto {
  @ApiPropertyOptional({
    description: 'Template variables to interpolate in the preview',
    type: 'object',
    additionalProperties: { type: 'string' },
  })
  @IsOptional()
  @IsObject()
  vars?: Record<string, string>;
}
