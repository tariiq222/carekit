import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoyasarWebhookMetadataDto {
  @ApiPropertyOptional({ description: 'Booking ID from payment metadata' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bookingId?: string;

  @ApiPropertyOptional({ description: 'Internal payment record ID' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  paymentId?: string;
}

export class MoyasarWebhookDto {
  @ApiProperty({ description: 'Moyasar payment ID' })
  @IsString()
  @MaxLength(255)
  id!: string;

  @ApiProperty({ description: "Payment status: 'paid' | 'failed' | 'authorized'", example: 'paid' })
  @IsString()
  @MaxLength(255)
  status!: string; // 'paid' | 'failed' | 'authorized'

  @ApiProperty({ description: 'Payment amount in halalat (SAR × 100)' })
  @IsNumber()
  amount!: number;

  @ApiProperty({ description: 'Currency code', example: 'SAR' })
  @IsString()
  @MaxLength(255)
  currency!: string;

  @ApiProperty({ description: 'Payment description' })
  @IsString()
  @MaxLength(500)
  description!: string;

  @ApiProperty({ type: () => MoyasarWebhookMetadataDto })
  @IsObject()
  metadata!: MoyasarWebhookMetadataDto;
}
