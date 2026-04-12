import { IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ApplyCouponDto {
  @IsUUID() invoiceId!: string;
  @IsUUID() clientId!: string;
  @IsString() @MinLength(3) @MaxLength(64) code!: string;
}
