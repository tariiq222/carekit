import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class ApplyCouponDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  serviceId?: string;

  @IsInt()
  @Min(0)
  amount: number;
}
