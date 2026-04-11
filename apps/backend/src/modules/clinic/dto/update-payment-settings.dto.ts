import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdatePaymentSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paymentMoyasarEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paymentAtClinicEnabled?: boolean;
}
