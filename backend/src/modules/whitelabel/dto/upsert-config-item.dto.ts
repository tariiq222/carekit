import { IsEnum, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { ConfigValueType } from '@prisma/client';

export class UpsertConfigItemDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  key!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  value!: string;

  @IsOptional()
  @IsEnum(ConfigValueType)
  type?: ConfigValueType;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
