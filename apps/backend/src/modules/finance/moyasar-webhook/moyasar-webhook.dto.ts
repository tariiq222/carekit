import { IsIn, IsInt, IsObject, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class MoyasarWebhookMetadataDto {
  @ApiPropertyOptional({ description: 'Invoice UUID embedded in the payment metadata', example: '00000000-0000-0000-0000-000000000000' })
  @IsOptional() @IsString() invoiceId?: string;
}

/**
 * Shape of the JSON body Moyasar POSTs to our webhook endpoint.
 * Signature verification uses the *raw* body (before JSON parse) and is
 * not part of this DTO — the handler reads it from headers/raw middleware.
 */
export class MoyasarWebhookDto {
  @ApiProperty({ description: 'Moyasar payment ID', example: 'pay_abc123' })
  @IsString() id!: string;

  @ApiProperty({ description: 'Payment status reported by Moyasar', enum: ['paid', 'failed', 'refunded'], example: 'paid' })
  @IsIn(['paid', 'failed', 'refunded']) status!: 'paid' | 'failed' | 'refunded';

  @ApiProperty({ description: 'Amount in the smallest currency unit (halalas)', example: 10000 })
  @IsInt() @Min(0) amount!: number;

  @ApiProperty({ description: 'ISO 4217 currency code', example: 'SAR' })
  @IsString() currency!: string;

  @ApiPropertyOptional({ description: 'Metadata attached when the payment was initiated', type: () => MoyasarWebhookMetadataDto })
  @IsOptional() @IsObject() @ValidateNested() @Type(() => MoyasarWebhookMetadataDto)
  metadata?: MoyasarWebhookMetadataDto;

  @ApiPropertyOptional({ description: 'Human-readable message from Moyasar (e.g. failure reason)', example: 'Insufficient funds' })
  @IsOptional() @IsString() message?: string;
}
