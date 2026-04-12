import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateEmailTemplateDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) nameAr?: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(300) subjectAr?: string;
  @IsOptional() @IsString() @MaxLength(300) subjectEn?: string;
  @IsOptional() @IsString() htmlBody?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
