import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class VerifyBankTransferDto {
  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
