import { IsNotEmpty, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class BankTransferUploadDto {
  @ApiProperty({ description: 'Booking ID to attach the bank transfer receipt to' })
  @IsUUID()
  @IsNotEmpty()
  bookingId!: string;
  // receipt file is handled by multer (not in DTO)
}
