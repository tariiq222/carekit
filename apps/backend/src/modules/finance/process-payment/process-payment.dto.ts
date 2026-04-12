import { IsEnum, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class ProcessPaymentDto {
  @IsUUID() invoiceId!: string;
  @IsNumber() @Min(0) amount!: number;
  @IsEnum(PaymentMethod) method!: PaymentMethod;
  @IsOptional() @IsString() gatewayRef?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}
