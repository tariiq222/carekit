import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateEmailTemplateDto {
  @IsString() @MinLength(2) @MaxLength(64) slug!: string;
  @IsString() @MinLength(1) @MaxLength(200) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @IsString() @MinLength(1) @MaxLength(300) subjectAr!: string;
  @IsOptional() @IsString() @MaxLength(300) subjectEn?: string;
  @IsString() htmlBody!: string;
}
