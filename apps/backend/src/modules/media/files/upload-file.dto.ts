import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { FileVisibility } from '@prisma/client';

export class UploadFileDto {
  @IsString() tenantId!: string;
  @IsString() filename!: string;
  @IsString() mimetype!: string;
  @IsInt() @Min(1) size!: number;
  @IsOptional() @IsEnum(FileVisibility) visibility?: FileVisibility;
  @IsOptional() @IsString() ownerType?: string;
  @IsOptional() @IsString() ownerId?: string;
  @IsOptional() @IsString() uploadedBy?: string;
  @IsOptional() @IsString() bucket?: string;
}
