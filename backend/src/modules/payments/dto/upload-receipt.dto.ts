import { IsNotEmpty, IsUrl } from 'class-validator';

export class UploadReceiptDto {
  @IsUrl()
  @IsNotEmpty()
  receiptUrl!: string;
}
