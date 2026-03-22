import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ZatcaSandboxReportDto {
  @ApiProperty({ description: 'Invoice ID to report to ZATCA sandbox' })
  @IsString()
  @IsNotEmpty()
  invoiceId!: string;
}

export interface ZatcaSandboxResult {
  success: boolean;
  status: string;
  validationResults?: {
    status: string;
    errorMessages?: unknown[];
    warningMessages?: unknown[];
  };
  reportingStatus?: string;
  message?: string;
}
