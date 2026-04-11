import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ReviewReceiptDto {
  @ApiProperty({ description: 'Whether the bank transfer receipt is approved' })
  @IsBoolean()
  @IsNotEmpty()
  approved!: boolean;

  @ApiPropertyOptional({ description: 'Admin notes on approval or rejection', maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
