import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentStatus } from '@prisma/client';

export class UpdatePaymentStatusDto {
  @IsEnum(PaymentStatus)
  @IsNotEmpty()
  status!: PaymentStatus;

  @IsOptional()
  @IsString()
  moyasarPaymentId?: string;

  @IsOptional()
  @IsString()
  transactionRef?: string;
}
