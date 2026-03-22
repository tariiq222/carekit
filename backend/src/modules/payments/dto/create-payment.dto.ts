import { IsEnum, IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsUUID()
  @IsNotEmpty()
  bookingId!: string;

  @IsInt()
  @Min(1)
  amount!: number;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
