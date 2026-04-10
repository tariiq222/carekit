import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoyasarSourceDto {
  @ApiProperty({ description: "Payment source type: 'creditcard' | 'applepay' | 'mada'", example: 'creditcard' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  type!: string; // 'creditcard' | 'applepay' | 'mada'

  // For credit card
  @ApiPropertyOptional({ description: 'Card number (credit card only)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  number?: string;

  @ApiPropertyOptional({ description: 'Cardholder name' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ description: 'Card CVC' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  cvc?: string;

  @ApiPropertyOptional({ description: 'Card expiry month (MM)', example: '12' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  month?: string;

  @ApiPropertyOptional({ description: 'Card expiry year (YYYY)', example: '2026' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  year?: string;

  // For token
  @ApiPropertyOptional({ description: 'Saved card token' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  token?: string;
}

export class CreateMoyasarPaymentDto {
  @ApiProperty({ description: 'Booking ID to pay for' })
  @IsUUID()
  @IsNotEmpty()
  bookingId!: string;

  @ApiProperty({ type: () => MoyasarSourceDto, description: 'Moyasar payment source' })
  @IsObject()
  @ValidateNested()
  @Type(() => MoyasarSourceDto)
  source!: MoyasarSourceDto;
}
