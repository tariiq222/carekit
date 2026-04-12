import { IsEnum, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { FileVisibility } from '@prisma/client';

/**
 * Body fields for multipart upload. The actual file bytes come via
 * @UploadedFile(); these are metadata sent alongside the file.
 */
export class UploadFileDto {
  @IsOptional() @IsEnum(FileVisibility) visibility?: FileVisibility;
  @IsOptional() @IsString() @MaxLength(32) ownerType?: string;
  @IsOptional() @IsUUID() ownerId?: string;
  @IsOptional() @IsUUID() uploadedBy?: string;
}
