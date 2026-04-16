import { IsIn, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class MoyasarWebhookMetadataDto {
  @IsOptional() @IsString() invoiceId?: string;
}

/**
 * Shape of the JSON body Moyasar POSTs to our webhook endpoint.
 * Signature verification uses the *raw* body (before JSON parse) and is
 * not part of this DTO — the handler reads it from headers/raw middleware.
 */
export class MoyasarWebhookDto {
  @IsString() id!: string;
  @IsIn(['paid', 'failed', 'refunded']) status!: 'paid' | 'failed' | 'refunded';
  @IsInt() @Min(0) amount!: number;
  @IsString() currency!: string;
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MoyasarWebhookMetadataDto)
  metadata?: MoyasarWebhookMetadataDto;
  @IsOptional() @IsString() message?: string;
}
