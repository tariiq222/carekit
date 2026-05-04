import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ZatcaOnboardDto {
  @ApiProperty({ description: 'VAT registration number for ZATCA onboarding', example: '300000000000003' })
  @IsString() @IsNotEmpty() vatRegistrationNumber!: string;

  @ApiProperty({ description: 'Seller name as registered with ZATCA', example: 'عيادة الرعاية' })
  @IsString() @IsNotEmpty() sellerName!: string;
}
