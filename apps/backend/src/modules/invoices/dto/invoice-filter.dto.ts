import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ZatcaStatus } from '@prisma/client';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class InvoiceFilterDto {
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ type: Number, minimum: 1, maximum: 100, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  perPage?: number = 20;

  @ApiPropertyOptional({ type: String, description: 'Search by invoice number or patient name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ type: String, example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @ApiPropertyOptional({ type: String, example: '2024-12-31' })
  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @ApiPropertyOptional({ enum: ZatcaStatus })
  @IsOptional()
  @IsEnum(ZatcaStatus)
  zatcaStatus?: ZatcaStatus;
}
