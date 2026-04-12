import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsObject, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { DocumentStatus } from '@prisma/client';

export class ListDocumentsDto {
  @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) limit?: number;
}

export class UpdateDocumentDto {
  @IsOptional() @IsString() @MaxLength(500) title?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
