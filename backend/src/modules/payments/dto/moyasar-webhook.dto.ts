import { IsNumber, IsObject, IsOptional, IsString } from 'class-validator';

export class MoyasarWebhookMetadataDto {
  @IsOptional()
  @IsString()
  bookingId?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;
}

export class MoyasarWebhookDto {
  @IsString()
  id!: string;

  @IsString()
  status!: string; // 'paid' | 'failed' | 'authorized'

  @IsNumber()
  amount!: number;

  @IsString()
  currency!: string;

  @IsString()
  description!: string;

  @IsObject()
  metadata!: MoyasarWebhookMetadataDto;
}
