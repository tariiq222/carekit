import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateOfferingDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  nameAr!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }) => value?.trim())
  nameEn!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionAr?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  descriptionEn?: string;

  @ApiProperty()
  @IsUUID()
  practitionerId!: string;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  minParticipants!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  maxParticipants!: number;

  @ApiProperty({ description: 'Price per person in halalat (0 = free)', minimum: 0 })
  @IsInt()
  @Min(0)
  pricePerPersonHalalat!: number;

  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  durationMin!: number;

  @ApiPropertyOptional({ default: 48 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  paymentDeadlineHours?: number;
}
