import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ReviewReceiptDto {
  @IsBoolean()
  @IsNotEmpty()
  approved!: boolean;

  @IsOptional()
  @IsString()
  adminNotes?: string;
}
