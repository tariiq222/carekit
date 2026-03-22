import { IsNotEmpty, IsUUID } from 'class-validator';

export class BankTransferUploadDto {
  @IsUUID()
  @IsNotEmpty()
  bookingId!: string;
  // receipt file is handled by multer (not in DTO)
}
