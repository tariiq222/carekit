import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class GeneratePresignedUrlDto {
  @IsOptional() @IsInt() @Min(60) @Max(86400) @Type(() => Number) expirySeconds?: number;
}
