import { IsIn, IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class EmbedDocumentDto {
  @IsString() @MinLength(1) title!: string;
  @IsString() @MinLength(1) content!: string;
  @IsIn(['manual', 'url', 'file']) sourceType!: 'manual' | 'url' | 'file';
  @IsOptional() @IsString() sourceRef?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
