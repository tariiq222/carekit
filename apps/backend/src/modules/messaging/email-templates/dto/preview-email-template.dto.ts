import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsObject, IsString } from 'class-validator';

export class PreviewEmailTemplateDto {
  @ApiProperty({ description: 'Template variable context (key-value pairs for interpolation)', example: { patientName: 'Ahmed', clinicName: 'CareKit' } })
  @IsObject()
  context!: Record<string, unknown>;

  @ApiProperty({ description: 'Language for the preview', enum: ['ar', 'en'], example: 'ar' })
  @IsString()
  @IsIn(['ar', 'en'])
  lang!: 'ar' | 'en';
}
