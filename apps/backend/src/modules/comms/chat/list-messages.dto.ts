import { IsInt, IsOptional, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ListMessagesDto {
  @IsOptional() @IsUUID() cursor?: string;
  @IsOptional() @IsInt() @Min(1) @Type(() => Number) limit?: number;
}
