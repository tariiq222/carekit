import { IsBoolean, IsEmail, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class OnboardEmployeeDto {
  @IsOptional() @IsString() @MaxLength(100) title?: string;

  @IsString() @MaxLength(200) nameEn!: string;
  @IsString() @MaxLength(200) nameAr!: string;

  @IsEmail() email!: string;

  @IsString() @MaxLength(200) specialty!: string;
  @IsOptional() @IsString() @MaxLength(200) specialtyAr?: string;

  @IsOptional() @IsString() bio?: string;
  @IsOptional() @IsString() bioAr?: string;

  @IsOptional() @IsInt() @Min(0) experience?: number;

  @IsOptional() @IsString() education?: string;
  @IsOptional() @IsString() educationAr?: string;

  @IsOptional() @IsString() avatarUrl?: string | null;

  @IsOptional() @IsBoolean() isActive?: boolean;
}
