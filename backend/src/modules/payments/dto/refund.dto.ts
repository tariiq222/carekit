import { IsInt, IsNotEmpty, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class RefundDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  amount?: number; // omit for full refund

  @IsNotEmpty()
  @IsString()
  @MaxLength(1000)
  reason!: string;
}
