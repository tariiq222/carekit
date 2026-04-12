import { IsEnum, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { DocumentStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

export class ListDocumentsDto extends PaginationDto {
  @IsOptional() @IsEnum(DocumentStatus) status?: DocumentStatus;
}

export class UpdateDocumentDto {
  @IsOptional() @IsString() @MaxLength(500) title?: string;
  @IsOptional() @IsObject() metadata?: Record<string, unknown>;
}
