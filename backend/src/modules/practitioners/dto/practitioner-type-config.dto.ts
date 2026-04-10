import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PractitionerDurationOptionInput {
  @ApiProperty({ description: 'Label for this duration option', example: '30 min' })
  @IsString()
  @MinLength(1)
  label!: string;

  @ApiPropertyOptional({ description: 'Label in Arabic' })
  @IsOptional()
  @IsString()
  labelAr?: string;

  @ApiProperty({ description: 'Duration in minutes', minimum: 5, maximum: 480 })
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes!: number;

  @ApiProperty({ description: 'Price in halalat (smallest currency unit)', minimum: 0 })
  @IsInt()
  @Min(0)
  price!: number;

  @ApiPropertyOptional({ description: 'Whether this is the default duration option' })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({ description: 'Display sort order', minimum: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class PractitionerTypeConfigDto {
  @ApiProperty({
    enum: ['in_person', 'online'],
    description: 'Booking type this config applies to',
  })
  @IsEnum(['in_person', 'online'])
  bookingType!: string;

  @ApiPropertyOptional({
    description: 'Override price in halalat. Null = use service default.',
    minimum: 0,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number | null;

  @ApiPropertyOptional({
    description: 'Override duration in minutes. Null = use service default.',
    minimum: 5,
    maximum: 480,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  duration?: number | null;

  @ApiPropertyOptional({ description: 'Whether to use custom duration options instead of a fixed duration' })
  @IsOptional()
  @IsBoolean()
  useCustomOptions?: boolean;

  @ApiPropertyOptional({ description: 'Whether this booking type config is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    isArray: true,
    type: () => PractitionerDurationOptionInput,
    description: 'Custom duration options for this booking type',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PractitionerDurationOptionInput)
  durationOptions?: PractitionerDurationOptionInput[];
}
