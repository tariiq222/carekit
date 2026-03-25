import {
  IsOptional,
  IsString,
  IsBoolean,
  IsDateString,
  MaxLength,
} from 'class-validator';

export class UpdateGiftCardDto {
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  purchasedBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  redeemedBy?: string;
}
