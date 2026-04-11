import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class CreateGiftCardDto {
  @ApiPropertyOptional({ description: 'Custom gift card code (auto-generated if omitted)', example: 'GC-VIP2026', minLength: 3, maxLength: 20 })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]+$/i, {
    message: 'Code must contain only letters, numbers, and hyphens',
  })
  code?: string;

  @ApiProperty({ description: 'Initial credit amount in halalat', minimum: 1, example: 50000 })
  @IsInt()
  @Min(1)
  initialAmount: number;

  @ApiPropertyOptional({ description: 'Expiry date (ISO 8601)', example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Whether the gift card is active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
