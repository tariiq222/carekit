import { IsDateString, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateInvoiceDto {
  @IsUUID() bookingId!: string;
  @IsUUID() branchId!: string;
  @IsUUID() clientId!: string;
  @IsUUID() employeeId!: string;
  @IsNumber() @Min(0) subtotal!: number;
  @IsOptional() @IsNumber() @Min(0) discountAmt?: number;
  @IsOptional() @IsNumber() @Min(0) vatRate?: number;
  @IsOptional() @IsString() notes?: string;
  @IsOptional() @IsDateString() dueAt?: string;
}
