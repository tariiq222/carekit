import { IsString, IsOptional, IsIn } from 'class-validator';

export class VerifyPaymentDto {
  @IsIn(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsString()
  @IsOptional()
  transferRef?: string;
}
