import { IsNumber, IsUUID, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Metadata sent alongside the receipt file in multipart/form-data.
 * The file bytes come through @UploadedFile() and are not part of this DTO.
 */
export class BankTransferUploadDto {
  @IsUUID() invoiceId!: string;
  @IsUUID() clientId!: string;
  @IsNumber() @Min(0) @Type(() => Number) amount!: number;
}
