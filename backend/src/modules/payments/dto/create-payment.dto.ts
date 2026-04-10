import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsInt, IsNotEmpty, IsUUID, Min } from 'class-validator';
import { PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Booking ID to pay for', format: 'uuid' })
  @IsUUID()
  @IsNotEmpty()
  bookingId!: string;

  @ApiProperty({
    description: 'Payment amount in halalat (SAR × 100)',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  amount!: number;

  @ApiProperty({ description: 'Payment method', enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
}
