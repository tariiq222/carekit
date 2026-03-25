import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  IsDateString,
  MinLength,
  MaxLength,
  Matches,
  Min,
} from 'class-validator';

export class CreateGiftCardDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(20)
  @Matches(/^[A-Z0-9-]+$/i, {
    message: 'Code must contain only letters, numbers, and hyphens',
  })
  code?: string;

  @IsInt()
  @Min(1)
  initialAmount: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
