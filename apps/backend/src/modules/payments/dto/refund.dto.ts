import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class RefundDto {
  @ApiPropertyOptional({ description: 'Partial refund amount in halalat (SAR × 100). Omit for full refund.', minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number; // omit for full refund

  @ApiProperty({ description: 'Reason for the refund', maxLength: 1000 })
  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
