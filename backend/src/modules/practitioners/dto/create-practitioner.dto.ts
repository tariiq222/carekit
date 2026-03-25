import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePractitionerDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  specialty!: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  specialtyAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bio?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  bioAr?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  experience?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  education?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
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
}
