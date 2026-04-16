import { IsBoolean, IsInt, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

const NOT_WHITESPACE_ONLY = /\S/;

export class CreateDepartmentDto {
  @IsString()
  @MaxLength(200)
  @Matches(NOT_WHITESPACE_ONLY, { message: 'nameAr must not be whitespace only' })
  nameAr!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  @Matches(NOT_WHITESPACE_ONLY, { message: 'nameEn must not be whitespace only' })
  nameEn?: string;

  @IsOptional() @IsString() @MaxLength(1000) descriptionAr?: string;
  @IsOptional() @IsString() @MaxLength(1000) descriptionEn?: string;
  @IsOptional() @IsString() @MaxLength(100) icon?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsBoolean() isVisible?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
