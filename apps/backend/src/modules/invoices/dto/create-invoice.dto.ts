import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateInvoiceDto {
  @ApiProperty({ description: 'Payment ID to generate an invoice for' })
  @IsUUID()
  @IsNotEmpty()
  paymentId!: string;
}
