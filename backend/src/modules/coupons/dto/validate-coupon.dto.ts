import { IsString, IsNotEmpty, IsInt, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateCouponDto {
  @ApiProperty({ description: 'Coupon code or gift card code' })
  @IsString()
  @IsNotEmpty()
  code!: string;

  @ApiProperty({ description: 'Service ID for service-restricted coupons' })
  @IsString()
  @IsNotEmpty()
  serviceId!: string;

  @ApiProperty({ description: 'Original booking amount in SAR (before discount)' })
  @IsInt()
  @Min(0)
  amount!: number;
}
