import { IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ZatcaSubmitDto {
  @ApiProperty({ description: 'Invoice UUID to submit to ZATCA', example: '00000000-0000-0000-0000-000000000000' })
  @IsUUID() invoiceId!: string;
}
