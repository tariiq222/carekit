import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CancelApproveDto {
  @IsEnum(['full', 'partial', 'none'])
  @IsNotEmpty()
  refundType!: 'full' | 'partial' | 'none';

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
