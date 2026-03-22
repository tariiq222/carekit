import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ConfigValueType } from '@prisma/client';

export class UpsertConfigItemDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @IsString()
  @IsNotEmpty()
  value!: string;

  @IsOptional()
  @IsEnum(ConfigValueType)
  type?: ConfigValueType;

  @IsOptional()
  @IsString()
  description?: string;
}
