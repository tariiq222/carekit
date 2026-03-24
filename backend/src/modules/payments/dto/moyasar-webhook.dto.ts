import { IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class MoyasarWebhookMetadataDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  bookingId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  paymentId?: string;
}

export class MoyasarWebhookDto {
  @IsString()
  @MaxLength(255)
  id!: string;

  @IsString()
  @MaxLength(255)
  status!: string; // 'paid' | 'failed' | 'authorized'

  @IsNumber()
  amount!: number;

  @IsString()
  @MaxLength(255)
  currency!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsObject()
  metadata!: MoyasarWebhookMetadataDto;
}
