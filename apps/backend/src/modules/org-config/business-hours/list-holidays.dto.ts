import { IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ListHolidaysDto {
  @ApiProperty({ description: 'UUID of the branch to list holidays for', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() @Type(() => String) branchId!: string;

  @ApiPropertyOptional({ description: 'Filter by year (2000–3000)', example: 2025 })
  @IsOptional() @IsInt() @Min(2000) @Max(3000) @Type(() => Number) year?: number;
}
