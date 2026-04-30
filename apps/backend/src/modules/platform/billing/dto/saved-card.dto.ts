import { IsBoolean, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export class AddSavedCardDto {
  @IsString()
  @Matches(/^token_[A-Za-z0-9_-]+$/)
  moyasarTokenId!: string;

  @IsOptional()
  @IsBoolean()
  makeDefault?: boolean;

  @IsOptional()
  @IsUUID('4')
  idempotencyKey?: string;
}
