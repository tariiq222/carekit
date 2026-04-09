import { IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOfferingDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameAr!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameEn!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionAr?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  descriptionEn?: string;

  @IsUUID()
  @IsNotEmpty()
  practitionerId!: string;

  @IsInt()
  @Min(1)
  minParticipants!: number;

  @IsInt()
  @Min(1)
  maxParticipants!: number;

  @IsInt()
  @Min(0)
  pricePerPersonHalalat!: number;

  @IsInt()
  @Min(1)
  durationMin!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  paymentDeadlineHours?: number;
}
