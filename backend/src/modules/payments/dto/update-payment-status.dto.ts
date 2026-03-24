import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  moyasarPaymentId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  transactionRef?: string;
}
