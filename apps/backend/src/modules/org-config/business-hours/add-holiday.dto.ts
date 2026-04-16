import { IsDateString, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AddHolidayDto {
  @ApiProperty({ description: 'UUID of the branch this holiday applies to', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() branchId!: string;

  @ApiProperty({ description: 'Holiday date in ISO 8601 format (YYYY-MM-DD)', example: '2025-12-31' })
  @IsDateString() date!: string;

  @ApiProperty({ description: 'Holiday name in Arabic', example: 'اليوم الوطني' })
  @IsString() @MaxLength(200) nameAr!: string;

  @ApiPropertyOptional({ description: 'Holiday name in English', example: 'National Day' })
  @IsOptional() @IsString() @MaxLength(200) nameEn?: string;
}
