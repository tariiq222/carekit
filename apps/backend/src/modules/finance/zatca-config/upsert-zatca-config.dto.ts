import { IsOptional, IsString, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpsertZatcaConfigDto {
  @ApiPropertyOptional({ description: 'VAT registration number (15 digits)', example: '300000000000003' })
  @IsOptional() @IsString() vatRegistrationNumber?: string;

  @ApiPropertyOptional({ description: 'Legal seller name as registered with ZATCA', example: 'Carekit Medical Clinic' })
  @IsOptional() @IsString() sellerName?: string;

  @ApiPropertyOptional({ description: 'ZATCA integration environment', enum: ['sandbox', 'production'], example: 'sandbox' })
  @IsOptional() @IsIn(['sandbox', 'production']) environment?: string;
}
