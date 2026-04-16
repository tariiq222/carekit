import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class GeneratePresignedUrlDto {
  @ApiPropertyOptional({
    description: 'Validity duration of the presigned URL in seconds (60–86400)',
    minimum: 60,
    maximum: 86400,
    example: 3600,
  })
  @IsOptional() @IsInt() @Min(60) @Max(86400) @Type(() => Number) expirySeconds?: number;
}
