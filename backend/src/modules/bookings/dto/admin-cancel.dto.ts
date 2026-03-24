import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class AdminCancelDto {
  @IsEnum(['full', 'partial', 'none'])
  refundType!: 'full' | 'partial' | 'none';

  @IsOptional()
  @IsInt()
  @Min(1)
  refundAmount?: number;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
