import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateDepartmentDto {
  @IsString() @MaxLength(200) nameAr!: string;
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
  @IsOptional() @IsBoolean() isVisible?: boolean;
  @IsOptional() @IsInt() @Min(0) sortOrder?: number;
}
