import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateHolidayDto {
  @ApiProperty({ description: 'Holiday date in ISO format (YYYY-MM-DD)' })
  @IsDateString()
  date: string;

  @ApiProperty({ description: 'Holiday name in Arabic' })
  @IsString()
  @MinLength(1)
  nameAr: string;

  @ApiProperty({ description: 'Holiday name in English' })
  @IsString()
  @MinLength(1)
  nameEn: string;

  @ApiPropertyOptional({ description: 'Whether this holiday recurs every year' })
  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;
}
