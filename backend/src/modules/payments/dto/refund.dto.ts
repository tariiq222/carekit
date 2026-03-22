import { IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class RefundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number; // omit for full refund

  @IsNotEmpty()
  @IsString()
  reason!: string;
}
