import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MoyasarSourceDto {
  @IsString()
  @IsNotEmpty()
  type!: string; // 'creditcard' | 'applepay' | 'mada'

  // For credit card
  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  cvc?: string;

  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  year?: string;

  // For token
  @IsOptional()
  @IsString()
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
