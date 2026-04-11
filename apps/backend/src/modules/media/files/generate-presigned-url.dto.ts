import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class GeneratePresignedUrlDto {
  @IsString() tenantId!: string;
  @IsString() fileId!: string;
  @IsOptional() @IsInt() @Min(60) @Max(86400) expirySeconds?: number;
}
