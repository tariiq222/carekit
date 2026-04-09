import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateGroupSessionDto {
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

  @IsOptional()
  @IsUUID()
  departmentId?: string;

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
  durationMinutes!: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  paymentDeadlineHours?: number;

  @IsEnum(['fixed_date', 'on_capacity'] as const)
  schedulingMode!: 'fixed_date' | 'on_capacity';

  @ValidateIf((o: CreateGroupSessionDto) => o.schedulingMode === 'fixed_date')
  @IsDateString()
  @IsNotEmpty()
  startTime?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
