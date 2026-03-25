import { IsIn, IsObject, IsString } from 'class-validator';

export class PreviewEmailTemplateDto {
  @IsObject()
  context!: Record<string, unknown>;

  @IsString()
  @IsIn(['ar', 'en'])
  lang!: 'ar' | 'en';
}
