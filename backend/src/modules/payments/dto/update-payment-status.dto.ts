import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaymentStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePaymentStatusDto {
  @ApiProperty({ enum: PaymentStatus, description: 'New payment status' })
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  status!: PaymentStatus;

  @ApiPropertyOptional({ description: 'Moyasar payment ID (from webhook or manual lookup)' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  moyasarPaymentId?: string;

  @ApiPropertyOptional({ description: 'Bank transfer reference number' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionRef?: string;
}
