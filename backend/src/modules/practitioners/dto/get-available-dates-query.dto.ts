import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class GetAvailableDatesQueryDto {
  @ApiProperty({ description: 'Month in YYYY-MM format (e.g. 2026-04)' })
  @IsString()
  @IsNotEmpty()
  month!: string;

  @ApiPropertyOptional({ description: 'Duration in minutes', minimum: 5, maximum: 240 })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(5)
  @Max(240)
  duration?: number;

  @ApiPropertyOptional({ description: 'Service ID (UUID)' })
  @IsOptional()
  @IsString()
  serviceId?: string;

  @ApiPropertyOptional({ description: 'Branch ID (UUID)' })
  @IsOptional()
  @IsString()
  branchId?: string;
}
