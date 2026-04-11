import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ToggleFeatureFlagDto {
  @ApiProperty({ description: 'Enable or disable the feature' })
  @IsBoolean()
  enabled!: boolean;
}
