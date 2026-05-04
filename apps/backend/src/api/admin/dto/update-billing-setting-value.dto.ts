import { ApiProperty } from '@nestjs/swagger';
import { IsDefined } from 'class-validator';

export class UpdateBillingSettingValueDto {
  @ApiProperty({
    description: 'New value for the billing setting (type depends on the setting key)',
    oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
  })
  @IsDefined()
  value!: string | number | boolean;
}
