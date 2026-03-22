import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID()
  @IsNotEmpty()
  paymentId!: string;
}
