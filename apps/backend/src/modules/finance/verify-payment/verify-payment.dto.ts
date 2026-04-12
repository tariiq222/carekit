import { IsString, IsOptional, IsIn, IsDefined } from 'class-validator';

export class VerifyPaymentDto {
  @IsDefined()
  @IsIn(['approve', 'reject'])
  action!: 'approve' | 'reject';

  @IsString()
  @IsOptional()
  transferRef?: string;
}
