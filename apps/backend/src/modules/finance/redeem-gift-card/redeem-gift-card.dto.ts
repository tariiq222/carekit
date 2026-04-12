import { IsNumber, IsString, IsUUID, MaxLength, Min, MinLength } from 'class-validator';

export class RedeemGiftCardDto {
  @IsUUID() invoiceId!: string;
  @IsUUID() clientId!: string;
  @IsString() @MinLength(4) @MaxLength(64) code!: string;
  @IsNumber() @Min(0) amount!: number;
}
