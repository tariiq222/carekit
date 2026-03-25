import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';

export class OnboardPractitionerDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  title?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameEn!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  nameAr!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @IsNotEmpty()
  specialty!: string;

  @IsOptional()
  @IsString()
  specialtyAr?: string;

  @IsOptional()
  @IsString()
  bio?: string;

  @IsOptional()
  @IsString()
  bioAr?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  @IsOptional()
  @IsString()
  education?: string;

  @IsOptional()
  @IsString()
  educationAr?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceClinic?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  pricePhone?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  priceVideo?: number;

  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
