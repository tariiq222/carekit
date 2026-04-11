import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class UpdateGiftCardDto {
  @ApiPropertyOptional({ description: 'New expiry date (ISO 8601)', example: '2027-06-30T23:59:59.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Whether the gift card is active' })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Name or identifier of the purchaser', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  purchasedBy?: string;

  @ApiPropertyOptional({ description: 'Name or identifier of the redeemer', maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  redeemedBy?: string;
}
