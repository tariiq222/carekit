import { IsEnum, IsOptional, IsString } from 'class-validator';

export class VerifyBankTransferDto {
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
