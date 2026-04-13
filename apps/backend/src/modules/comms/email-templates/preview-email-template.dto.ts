import { IsIn, IsObject, IsOptional } from 'class-validator';

export class PreviewEmailTemplateDto {
  @IsIn(['ar', 'en'])
  lang!: 'ar' | 'en';

  @IsObject()
  @IsOptional()
  context?: Record<string, unknown>;
}
