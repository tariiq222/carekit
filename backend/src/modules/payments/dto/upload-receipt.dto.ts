import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUrl } from 'class-validator';

export class UploadReceiptDto {
  @ApiProperty({ description: 'Public URL of the uploaded bank transfer receipt' })
  @IsUrl()
  @IsNotEmpty()
  receiptUrl!: string;
}
