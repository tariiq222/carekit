import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export enum BookingTypeParam {
  in_person = 'in_person',
  online = 'online',
}

export class GetSlotsQueryDto {
  @ApiProperty({ description: 'Date in YYYY-MM-DD format' })
  @IsString()
  @IsNotEmpty()
  date!: string;

  @ApiPropertyOptional({ description: 'Duration in minutes', minimum: 5, maximum: 240 })
  @IsOptional()
  @Transform(({ value }: { value: string }) => parseInt(value, 10))
  @IsInt()
  @Min(5)
  @Max(240)
  duration?: number;

  @ApiPropertyOptional({ enum: BookingTypeParam })
  @IsOptional()
  @IsEnum(BookingTypeParam)
  bookingType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Branch ID for branch-scoped availability' })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
