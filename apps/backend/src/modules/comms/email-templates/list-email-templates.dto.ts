import { IsInt, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListEmailTemplatesDto {
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) page?: number;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}
