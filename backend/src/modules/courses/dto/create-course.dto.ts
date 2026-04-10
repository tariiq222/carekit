import {
  IsString,
  IsUUID,
  IsInt,
  IsEnum,
  IsBoolean,
  IsOptional,
  IsDateString,
  ValidateIf,
  Min,
  Max,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCourseDto {
  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameAr!: string;

  @ApiProperty({ maxLength: 255 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: string }) => value?.trim())
  nameEn!: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  descriptionAr?: string;

  @ApiPropertyOptional({ maxLength: 2000 })
  @IsString()
  @IsOptional()
  @MaxLength(2000)
  descriptionEn?: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  practitionerId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsUUID()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ minimum: 1, maximum: 52 })
  @IsInt()
  @Min(1)
  @Max(52)
  totalSessions!: number;

  @ApiProperty({ minimum: 1, maximum: 480 })
  @IsInt()
  @Min(1)
  @Max(480)
  durationPerSessionMin!: number;

  @ApiProperty({ enum: ['weekly', 'biweekly', 'monthly'] })
  @IsEnum(['weekly', 'biweekly', 'monthly'] as const)
  frequency!: 'weekly' | 'biweekly' | 'monthly';

  @ApiProperty({ minimum: 0, description: 'Price in halalat (SAR × 100). 0 = free.' })
  @IsInt()
  @Min(0)
  priceHalalat!: number;

  @ApiProperty()
  @IsBoolean()
  isGroup!: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 500, description: 'Required when isGroup = true' })
  @ValidateIf((o: CreateCourseDto) => o.isGroup === true)
  @IsInt()
  @Min(1)
  @Max(500)
  maxParticipants?: number;

  @ApiProperty({ enum: ['in_person', 'online', 'hybrid'] })
  @IsEnum(['in_person', 'online', 'hybrid'] as const)
  deliveryMode!: 'in_person' | 'online' | 'hybrid';

  @ApiPropertyOptional({ maxLength: 500 })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  location?: string;

  @ApiProperty({ format: 'date-time', description: 'ISO 8601 — first session date' })
  @IsDateString()
  startDate!: string;
}
