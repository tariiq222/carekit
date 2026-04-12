import { IsOptional, IsString, IsIn } from 'class-validator';

export class UpsertZatcaConfigDto {
  @IsOptional() @IsString() vatRegistrationNumber?: string;
  @IsOptional() @IsString() sellerName?: string;
  @IsOptional() @IsIn(['sandbox', 'production']) environment?: string;
}
