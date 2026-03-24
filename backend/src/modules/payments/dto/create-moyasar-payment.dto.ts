import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MoyasarSourceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  type!: string; // 'creditcard' | 'applepay' | 'mada'

  // For credit card
  @IsOptional()
  @IsString()
  @MaxLength(255)
  number?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  cvc?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  month?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  year?: string;

  // For token
  @IsOptional()
  @IsString()
  @MaxLength(255)
  token?: string;
}

export class CreateMoyasarPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  bookingId!: string;

  @IsObject()
  @ValidateNested()
  @Type(() => MoyasarSourceDto)
  source!: MoyasarSourceDto;
}
