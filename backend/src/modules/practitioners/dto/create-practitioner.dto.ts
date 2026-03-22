import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePractitionerDto {
  @IsUUID()
  @IsNotEmpty()
  userId!: string;

  @IsUUID()
  @IsNotEmpty()
  specialtyId!: string;

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
}
