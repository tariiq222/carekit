import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsInt, Min } from 'class-validator';

export class ApplyCouponDto {
  @ApiProperty({ description: 'Coupon code to apply', example: 'SAVE20' })
  @IsString()
  code: string;

  @ApiPropertyOptional({ description: 'Service ID for service-restricted coupons', example: 'uuid-here' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiProperty({ description: 'Booking amount in halalat before discount', example: 10000 })
  @IsInt()
  @Min(0)
  amount: number;
}
