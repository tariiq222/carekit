import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

export class RefundPaymentDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  amount?: number;
}
